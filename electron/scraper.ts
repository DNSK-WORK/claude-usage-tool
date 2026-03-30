import { BrowserWindow, session } from 'electron';

export interface UsageBar {
  used: number;
  limit: number;
  percentage: number;
  label?: string;
  context?: string;
}

export interface ClaudeMaxUsage {
  standard: UsageBar;
  advanced: UsageBar;
  bars?: UsageBar[];
  resetDate: string | null;
  lastUpdated: string;
  isAuthenticated: boolean;
  plan?: string;
  email?: string;
}

let loginWindow: BrowserWindow | null = null;
let platformLoginWindow: BrowserWindow | null = null;

const CLAUDE_BASE_URL = 'https://claude.ai';
const CLAUDE_SESSION_NAME = 'claude-session';

function getSession() {
  return session.fromPartition(`persist:${CLAUDE_SESSION_NAME}`);
}

function formatResetTime(resetsAt: string): string {
  const now = new Date();
  const resetDate = new Date(resetsAt);
  const diffMs = resetDate.getTime() - now.getTime();
  if (diffMs <= 0) return '';

  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `Resets in ${days}d`;
  }
  if (hours > 0 && mins > 0) return `Resets in ${hours}hr ${mins}min`;
  if (hours > 0) return `Resets in ${hours}hr`;
  return `Resets in ${mins}min`;
}

interface UsageApiResponse {
  five_hour: { utilization: number; resets_at: string } | null;
  seven_day: { utilization: number; resets_at: string } | null;
  seven_day_sonnet: { utilization: number; resets_at: string } | null;
  seven_day_opus: { utilization: number; resets_at: string } | null;
  extra_usage: { is_enabled: boolean; monthly_limit: number | null; used_credits: number | null; utilization: number | null } | null;
}

function mapUsageApiToResult(data: UsageApiResponse): ClaudeMaxUsage {
  const bars: UsageBar[] = [];

  if (data.five_hour) {
    bars.push({
      used: data.five_hour.utilization,
      limit: 100,
      percentage: data.five_hour.utilization,
      label: 'Current session',
      context: formatResetTime(data.five_hour.resets_at),
    });
  }
  if (data.seven_day) {
    bars.push({
      used: data.seven_day.utilization,
      limit: 100,
      percentage: data.seven_day.utilization,
      label: 'All models',
      context: formatResetTime(data.seven_day.resets_at),
    });
  }
  if (data.seven_day_sonnet) {
    bars.push({
      used: data.seven_day_sonnet.utilization,
      limit: 100,
      percentage: data.seven_day_sonnet.utilization,
      label: 'Sonnet only',
      context: formatResetTime(data.seven_day_sonnet.resets_at),
    });
  }
  if (data.seven_day_opus) {
    bars.push({
      used: data.seven_day_opus.utilization,
      limit: 100,
      percentage: data.seven_day_opus.utilization,
      label: 'Opus only',
      context: formatResetTime(data.seven_day_opus.resets_at),
    });
  }
  if (data.extra_usage?.is_enabled) {
    bars.push({
      used: data.extra_usage.used_credits ?? 0,
      limit: data.extra_usage.monthly_limit ?? 0,
      percentage: data.extra_usage.utilization ?? 0,
      label: 'Extra usage',
      context: '',
    });
  }

  const standard = bars[0] ?? { used: 0, limit: 0, percentage: 0 };
  const advanced = bars[1] ?? { used: 0, limit: 0, percentage: 0 };

  return {
    standard,
    advanced,
    bars,
    resetDate: bars[0]?.context ?? null,
    lastUpdated: new Date().toISOString(),
    isAuthenticated: true,
    plan: 'Max',
  };
}

export async function isAuthenticated(): Promise<boolean> {
  const ses = getSession();
  const cookies = await ses.cookies.get({ domain: '.claude.ai' });
  return cookies.some(c =>
    c.name === 'sessionKey' ||
    c.name === '__Secure-next-auth.session-token' ||
    c.name === 'lastActiveOrg' ||
    (c.name.includes('session') && c.value.length > 20)
  );
}

export async function scrapeClaudeUsage(): Promise<ClaudeMaxUsage | null> {
  const ses = getSession();
  const notAuthenticated: ClaudeMaxUsage = {
    standard: { used: 0, limit: 0, percentage: 0 },
    advanced: { used: 0, limit: 0, percentage: 0 },
    resetDate: null,
    lastUpdated: new Date().toISOString(),
    isAuthenticated: false,
  };

  try {
    // Step 1: 조직 목록에서 UUID 가져오기
    const orgsRes = await ses.fetch(`${CLAUDE_BASE_URL}/api/organizations`);
    if (orgsRes.status === 401 || orgsRes.status === 403) {
      console.log('Not authenticated (status', orgsRes.status, ')');
      return notAuthenticated;
    }
    const orgs = await orgsRes.json() as Array<{ uuid: string }>;
    if (!Array.isArray(orgs) || orgs.length === 0) {
      console.log('No organizations found');
      return notAuthenticated;
    }

    // Step 2: 각 조직에서 사용량 조회 (데이터 있는 첫 번째 사용)
    for (const org of orgs) {
      const usageRes = await ses.fetch(`${CLAUDE_BASE_URL}/api/organizations/${org.uuid}/usage`);
      if (!usageRes.ok) continue;

      const data = await usageRes.json() as UsageApiResponse;
      if (!data.five_hour && !data.seven_day) continue;

      console.log('Usage fetched via API for org:', org.uuid);
      return mapUsageApiToResult(data);
    }

    console.log('No usage data found across organizations');
    return notAuthenticated;
  } catch (error) {
    console.error('API usage fetch error:', error);
    return null;
  }
}


export function openLoginWindow(): Promise<boolean> {
  return new Promise((resolve) => {
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.focus();
      resolve(false);
      return;
    }

    loginWindow = new BrowserWindow({
      width: 500,
      height: 700,
      title: 'Login to Claude',
      webPreferences: {
        session: getSession(),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    loginWindow.on('closed', async () => {
      loginWindow = null;
      const auth = await isAuthenticated();
      resolve(auth);
    });

    loginWindow.webContents.on('did-navigate', async (_, url) => {
      if (url.includes('claude.ai') && !url.includes('login') && !url.includes('signup')) {
        setTimeout(() => loginWindow?.close(), 1000);
      }
    });

    loginWindow.loadURL(`${CLAUDE_BASE_URL}/login`);
  });
}

export function openPlatformLoginWindow(): Promise<boolean> {
  return new Promise((resolve) => {
    if (platformLoginWindow && !platformLoginWindow.isDestroyed()) {
      platformLoginWindow.focus();
      resolve(false);
      return;
    }

    platformLoginWindow = new BrowserWindow({
      width: 600,
      height: 750,
      title: 'Login to Claude Platform',
      webPreferences: {
        session: getSession(),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    let hasLoggedIn = false;
    let wasOnLoginPage = false;

    platformLoginWindow.on('closed', () => {
      platformLoginWindow = null;
      resolve(hasLoggedIn);
    });

    platformLoginWindow.webContents.on('did-finish-load', async () => {
      if (!platformLoginWindow || platformLoginWindow.isDestroyed()) return;

      const url = platformLoginWindow.webContents.getURL();
      if (!url.includes('platform.claude.com/settings/billing')) return;

      await new Promise(r => setTimeout(r, 2000));
      if (!platformLoginWindow || platformLoginWindow.isDestroyed()) return;

      const isLoginPage = await platformLoginWindow.webContents.executeJavaScript(`
        document.body.innerText.includes('Sign in or create a developer account') ||
        document.body.innerText.includes('Continue with Google')
      `);

      if (isLoginPage) {
        wasOnLoginPage = true;
      } else {
        hasLoggedIn = true;
        if (wasOnLoginPage) {
          setTimeout(() => platformLoginWindow?.close(), 1500);
        }
      }
    });

    platformLoginWindow.loadURL('https://platform.claude.com/settings/billing');
  });
}
