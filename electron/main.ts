import { app, BrowserWindow, ipcMain, Tray, nativeImage, Menu, screen, dialog, Notification } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import { scrapeClaudeUsage, openLoginWindow, openPlatformLoginWindow, isAuthenticated } from './scraper';
import { getCostReport, getCreditBalance, calculateTotalCost, getCostByModel } from './adminApi';

// Disable default error dialogs in production
if (app.isPackaged) {
  dialog.showErrorBox = () => {};
}

// Handle uncaught exceptions to prevent crashes from EPIPE errors
process.on('uncaughtException', (error) => {
  if (error.message?.includes('EPIPE')) return;
  if (!app.isPackaged) console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (message?.includes('EPIPE')) return;
  if (!app.isPackaged) console.error('Unhandled rejection:', reason);
});

// Load environment variables
const envPaths = [
  path.join(__dirname, '..', '.env.local'),
  path.join(app.getAppPath(), '.env.local'),
  path.join(process.cwd(), '.env.local'),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

// Settings store
const store = new Store({
  defaults: {
    telegramBotToken: '',
    telegramChatId: '',
    notificationThresholds: [80, 90],
    refreshInterval: 60,
  },
});

function getSetting<T>(key: string, fallback: T): T {
  return (store.get(key) as T) || fallback;
}

function getTelegramToken(): string {
  return (store.get('telegramBotToken') as string) || process.env.TELEGRAM_BOT_TOKEN || '';
}

function getTelegramChatId(): string {
  return (store.get('telegramChatId') as string) || process.env.TELEGRAM_CHAT_ID || '';
}

function getNotificationThresholds(): number[] {
  return (store.get('notificationThresholds') as number[]) || [80, 90];
}

function getRefreshInterval(): number {
  return ((store.get('refreshInterval') as number) || 60) * 1000;
}

console.log('Admin key configured:', !!process.env.ANTHROPIC_ADMIN_KEY || !!(store?.get('adminApiKey')));

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let refreshInterval: NodeJS.Timeout | null = null;
let refreshCount = 0;
let cachedApiCost: Awaited<ReturnType<typeof fetchApiCost>> = null;
const API_COST_REFRESH_EVERY = 5; // fetch cost every Nth usage refresh

const isDev = !app.isPackaged;

// Track notified thresholds to avoid duplicate notifications
const notifiedThresholds: Record<string, number> = {};

// Track previous percentages for Telegram notifications
const previousPercentages: Record<string, number> = {};

// Usage history: circular buffer of last 100 readings per bar label, persisted across restarts
const HISTORY_MAX = 100;
type HistoryEntry = { ts: number; pct: number };

function loadHistory(): Map<string, HistoryEntry[]> {
  const saved = store.get('usageHistory') as Record<string, HistoryEntry[]> | undefined;
  if (!saved) return new Map();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
  const pruned: Record<string, HistoryEntry[]> = {};
  for (const [label, entries] of Object.entries(saved)) {
    const fresh = entries.filter(e => e.ts > cutoff);
    if (fresh.length > 0) pruned[label] = fresh;
  }
  return new Map(Object.entries(pruned));
}

function saveHistory(map: Map<string, HistoryEntry[]>) {
  store.set('usageHistory', Object.fromEntries(map));
}

let usageHistory: Map<string, HistoryEntry[]>;
try {
  usageHistory = loadHistory();
} catch (err) {
  console.error('Failed to load usage history, starting fresh:', err);
  usageHistory = new Map();
}

function appendHistory(label: string, pct: number) {
  if (!usageHistory.has(label)) usageHistory.set(label, []);
  const arr = usageHistory.get(label)!;
  arr.push({ ts: Date.now(), pct });
  if (arr.length > HISTORY_MAX) arr.shift();
  saveHistory(usageHistory);
}

function computeBurnRate(label: string, currentPct: number): { ratePerHour: number; etaMinutes: number | null } {
  const arr = usageHistory.get(label);
  if (!arr || arr.length < 2) return { ratePerHour: 0, etaMinutes: null };

  const oldest = arr[0];
  const newest = arr[arr.length - 1];
  const deltaMs = newest.ts - oldest.ts;
  const deltaPct = newest.pct - oldest.pct;

  if (deltaMs <= 0 || deltaPct <= 0) return { ratePerHour: 0, etaMinutes: null };

  const ratePerHour = (deltaPct / deltaMs) * 3600000;
  const ratePerMin = deltaPct / (deltaMs / 60000);
  const remaining = 100 - currentPct;
  const etaMinutes = remaining / ratePerMin;

  // Hide if non-finite or > 24 hours
  if (!isFinite(etaMinutes) || etaMinutes > 1440) return { ratePerHour, etaMinutes: null };

  return { ratePerHour, etaMinutes };
}

async function sendTelegramMessage(message: string): Promise<void> {
  const botToken = getTelegramToken();
  const chatId = getTelegramChatId();
  if (!botToken || !chatId) return;

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.error('Telegram API error:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
}

function checkAndNotify(bars: Array<{ percentage: number; label?: string; context?: string }>) {
  const THRESHOLDS = getNotificationThresholds();

  // Telegram: only track "Current session"
  const sessionBar = bars.find(b => b.label?.toLowerCase().includes('current session'));
  if (sessionBar) {
    const label = sessionBar.label || 'Current session';
    const resetTime = formatResetTime(sessionBar.context);
    const resetSuffix = resetTime ? `\n⏳ Time remaining: ${resetTime}` : '';
    const prevPct = previousPercentages[label];
    if (prevPct === undefined) {
      sendTelegramMessage(`📊 <b>Claude Usage</b>\n${label}: ${sessionBar.percentage}%${resetSuffix}`);
      addLog(`Telegram: ${label} initial ${sessionBar.percentage}%`);
    } else {
      const prevBucket = Math.floor(prevPct / 10);
      const currBucket = Math.floor(sessionBar.percentage / 10);
      if (currBucket > prevBucket) {
        sendTelegramMessage(`⚠️ <b>Claude Usage Alert</b>\n${label}: ${prevPct}% → ${sessionBar.percentage}%${resetSuffix}`);
        addLog(`Telegram: ${label} ${prevPct}% → ${sessionBar.percentage}%`);
      }
    }
    previousPercentages[label] = sessionBar.percentage;
  }

  for (const bar of bars) {
    const label = bar.label || 'Usage';
    for (const threshold of THRESHOLDS) {
      const key = `${label}-${threshold}`;
      if (bar.percentage >= threshold && !notifiedThresholds[key]) {
        notifiedThresholds[key] = Date.now();
        if (Notification.isSupported()) {
          new Notification({
            title: 'Claude Usage Alert',
            body: `${label}: ${bar.percentage}% used (${threshold}% threshold reached)`,
            silent: false,
          }).show();
        }
      }
    }
    for (const threshold of THRESHOLDS) {
      const key = `${label}-${threshold}`;
      if (bar.percentage < threshold && notifiedThresholds[key]) {
        delete notifiedThresholds[key];
      }
    }
  }
}

// Activity log system
interface LogEntry {
  timestamp: string;
  message: string;
}
const activityLogs: LogEntry[] = [];
const MAX_LOGS = 20;

function addLog(message: string) {
  const entry: LogEntry = { timestamp: new Date().toISOString(), message };
  activityLogs.push(entry);
  if (activityLogs.length > MAX_LOGS) activityLogs.shift();
  console.log(`[${entry.timestamp}] ${message}`);
}

function getRecentLogs(count = 6): LogEntry[] {
  return activityLogs.slice(-count);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 480,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'inactive',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const htmlPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(htmlPath);
  }

  mainWindow.on('blur', () => {
    mainWindow?.hide();
    mainWindow?.setVibrancy(null as unknown as 'under-window');
  });

  ipcMain.on('app:resize', (_event, height: number) => {
    if (!mainWindow) return;
    const clampedHeight = Math.min(Math.max(height + 2, 100), 700);
    const [width] = mainWindow.getSize();
    mainWindow.setSize(width, clampedHeight);
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'trayIconTemplate.png');
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } catch {
    icon = nativeImage.createEmpty();
  }

  if (icon.isEmpty()) {
    const size = 16;
    const canvas = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      canvas[i * 4] = 100; canvas[i * 4 + 1] = 100;
      canvas[i * 4 + 2] = 100; canvas[i * 4 + 3] = 255;
    }
    icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
  }

  tray = new Tray(icon);
  tray.setToolTip('Claude Usage Tool');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Refresh', click: () => refreshAllData() },
    { type: 'separator' },
    {
      label: 'About',
      click: () => {
        const aboutWindow = new BrowserWindow({
          width: 300, height: 200,
          resizable: false, minimizable: false, maximizable: false,
          title: 'About Claude Usage Tool',
          webPreferences: { nodeIntegration: false, contextIsolation: true },
        });
        const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
        const iconBase64 = fs.existsSync(iconPath)
          ? 'data:image/png;base64,' + fs.readFileSync(iconPath).toString('base64')
          : '';
        aboutWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`
          <!DOCTYPE html><html><head><style>
            body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a1a;color:#fff;text-align:center;-webkit-user-select:none}
            img{width:64px;height:64px;margin-bottom:12px}h1{font-size:16px;margin:0 0 4px 0;font-weight:600}
            .version{font-size:12px;color:#888;margin-bottom:8px}.author{font-size:12px;color:#aaa}
            a{color:#d97706;text-decoration:none}a:hover{text-decoration:underline}
          </style></head><body>
            <img src="${iconBase64}" alt="icon"/>
            <h1>Claude Usage Tool</h1>
            <div class="version">ver 0.11</div>
            <div class="author">by <a href="mailto:kingi@kingigilbert.com">Kingi Gilbert</a></div>
          </body></html>
        `));
        aboutWindow.setMenu(null);
      }
    },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.on('click', () => mainWindow?.isVisible() ? mainWindow.hide() : showWindow());
  tray.on('right-click', () => tray?.popUpContextMenu(contextMenu));
}

function showWindow() {
  if (!mainWindow || !tray) return;
  const trayBounds = tray.getBounds();
  const windowBounds = mainWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  let y = Math.round(trayBounds.y + trayBounds.height + 4);

  if (x + windowBounds.width > display.bounds.x + display.bounds.width)
    x = display.bounds.x + display.bounds.width - windowBounds.width;
  if (x < display.bounds.x) x = display.bounds.x;

  mainWindow.setPosition(x, y, false);
  mainWindow.setVibrancy('under-window');
  mainWindow.show();
  mainWindow.focus();
  // Push latest data immediately so user doesn't see stale state
  refreshAllData();
}

function formatResetTime(context?: string): string {
  if (!context) return '';
  const enMatch = context.match(/(\d+)\s*hr?\s*(\d+)?\s*min?/i);
  if (enMatch) {
    const hours = enMatch[1];
    const minutes = enMatch[2];
    return minutes ? `${hours}hr ${minutes}min` : `${hours}hr`;
  }
  const krMatch = context.match(/(\d+)\s*시간\s*(\d+)?\s*분?/);
  if (krMatch) {
    const hours = krMatch[1];
    const minutes = krMatch[2];
    return minutes ? `${hours}hr ${minutes}min` : `${hours}hr`;
  }
  const minOnly = context.match(/(\d+)\s*min/i) || context.match(/(\d+)\s*분/);
  if (minOnly) return `${minOnly[1]}min`;
  const dateMatch = context.match(/Resets?\s+(.+)/i);
  if (dateMatch) {
    const dateStr = dateMatch[1].trim();
    return dateStr.length <= 20 ? dateStr : dateStr.substring(0, 20);
  }
  return '';
}

function updateTrayTitle(claudeUsage: { isAuthenticated: boolean; bars?: Array<{ percentage: number; label?: string; context?: string }> } | null) {
  if (!tray) return;
  if (!claudeUsage?.isAuthenticated) { tray.setTitle(''); return; }

  const sessionBar = claudeUsage.bars?.find(b => b.label?.toLowerCase().includes('current session'))
    || claudeUsage.bars?.[0];

  if (sessionBar !== undefined) {
    const resetTime = formatResetTime(sessionBar.context);
    const parts = [`${sessionBar.percentage}%`];
    if (resetTime) parts.push(resetTime);
    tray.setTitle(` ${parts.join(' | ')}`);
  } else {
    tray.setTitle('');
  }
}

function getAdminKey(): string {
  return (store.get('adminApiKey') as string) || process.env.ANTHROPIC_ADMIN_KEY || '';
}

async function fetchApiCost() {
  const adminKey = getAdminKey();
  if (!adminKey?.startsWith('sk-ant-admin')) return null;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0] + 'T00:00:00Z';
    const endDateStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] + 'T00:00:00Z';

    const [costReport, creditBalance] = await Promise.all([
      getCostReport(adminKey, { starting_at: startDate, ending_at: endDateStr, group_by: ['workspace_id'], limit: 31 }),
      getCreditBalance(adminKey).catch(() => null),
    ]);

    const totalCost = calculateTotalCost(costReport);
    const byModel = getCostByModel(costReport);

    return {
      totalCost,
      byModel,
      creditBalance: creditBalance?.available_credit ?? null,
      hasAdminKey: true,
    };
  } catch (err) {
    addLog(`API cost fetch error: ${err instanceof Error ? err.message : String(err)}`);
    return { totalCost: 0, byModel: {}, creditBalance: null, hasAdminKey: true };
  }
}

let isRefreshing = false;

async function refreshAllData() {
  if (!mainWindow) return;
  if (isRefreshing) { addLog('Refresh already in progress, skipping'); return; }
  isRefreshing = true;
  addLog('Refreshing data...');
  refreshCount++;

  let fetchError: string | null = null;
  try {
    const shouldRefreshCost = refreshCount === 1 || refreshCount % API_COST_REFRESH_EVERY === 0;

    let claudeUsage: Awaited<ReturnType<typeof scrapeClaudeUsage>> = null;
    try {
      claudeUsage = await scrapeClaudeUsage();
      if (claudeUsage?.isAuthenticated) addLog(`Usage: ${claudeUsage.bars?.length || 0} bars fetched`);
      else if (claudeUsage) addLog('Usage: Not authenticated');
      else { addLog('Usage: fetch returned null'); fetchError = 'Connection error'; }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Usage error: ${msg}`);
      fetchError = msg.includes('abort') || msg.includes('timeout') ? 'Request timed out' : `Fetch error: ${msg}`;
    }

    const freshApiCost = shouldRefreshCost ? await fetchApiCost() : cachedApiCost;
    if (shouldRefreshCost) cachedApiCost = freshApiCost;
    const apiCost = freshApiCost ?? cachedApiCost;

    updateTrayTitle(claudeUsage);

    // Update history + compute burn rates
    const history: Array<{ label: string; readings: Array<{ ts: number; pct: number }> }> = [];
    const burnRates: Array<{ label: string; ratePerHour: number; etaMinutes: number | null }> = [];

    if (claudeUsage?.isAuthenticated && claudeUsage.bars) {
      checkAndNotify(claudeUsage.bars);

      for (const bar of claudeUsage.bars) {
        const label = bar.label || 'Usage';
        appendHistory(label, bar.percentage);
        const burn = computeBurnRate(label, bar.percentage);
        burnRates.push({ label, ...burn });
        history.push({ label, readings: [...(usageHistory.get(label) || [])] });
      }
    }

    // Only push to renderer if window is visible — avoids waking the renderer process
    if (mainWindow.isVisible()) {
      mainWindow.webContents.send('app:data-updated', {
        claudeUsage,
        timestamp: new Date().toISOString(),
        logs: getRecentLogs(6),
        history,
        burnRates,
        apiCost,
        fetchError,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addLog(`Refresh failed: ${message}`);
  } finally {
    isRefreshing = false;
  }
}

function startAutoRefresh() {
  refreshAllData();
  const interval = getRefreshInterval();
  refreshInterval = setInterval(refreshAllData, interval);
}

// IPC Handlers
ipcMain.handle('claude-max:get-usage', async () => {
  try { return await scrapeClaudeUsage(); }
  catch (error) { console.error('Failed to get Claude usage:', error); return null; }
});

ipcMain.handle('claude-max:is-authenticated', async () => isAuthenticated());
ipcMain.handle('claude-max:login', async () => openLoginWindow());
ipcMain.handle('platform:login', async () => openPlatformLoginWindow());
ipcMain.handle('app:refresh-all', async () => refreshAllData());

ipcMain.handle('app:get-admin-key-status', () => ({
  configured: !!process.env.ANTHROPIC_ADMIN_KEY?.startsWith('sk-ant-admin'),
}));

ipcMain.handle('settings:get', () => {
  const storedKey = (store.get('adminApiKey') as string) || '';
  const envKey = process.env.ANTHROPIC_ADMIN_KEY || '';
  const displayKey = storedKey
    ? '••••' + storedKey.slice(-4)
    : (envKey ? '(from .env.local)' : '');
  return {
    telegramBotToken: getTelegramToken(),
    telegramChatId: getTelegramChatId(),
    notificationThresholds: getNotificationThresholds(),
    refreshInterval: getSetting<number>('refreshInterval', 60),
    adminApiKey: displayKey,
  };
});

ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
  store.set(key, value);

  // Restart refresh interval if it changed
  if (key === 'refreshInterval' && refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = setInterval(refreshAllData, getRefreshInterval());
  }
});

ipcMain.handle('telegram:test', async () => {
  const botToken = getTelegramToken();
  const chatId = getTelegramChatId();
  if (!botToken || !chatId) {
    return { ok: false, error: 'Bot token and Chat ID are required' };
  }
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: '✅ Claude Usage Tool — test message', parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `Telegram error ${response.status}: ${text}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});

// App lifecycle
app.whenReady().then(() => {
  // Launch at login (production only)
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  createWindow();
  createTray();
  startAutoRefresh();

  // Auto-updater (production only)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
    // Re-check every 4 hours
    setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (refreshInterval) clearInterval(refreshInterval);
});

if (process.platform === 'darwin') app.dock?.hide();
