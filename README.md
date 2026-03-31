# Claude Usage Tool

A lightweight macOS menu bar app that monitors your Claude Max/Pro subscription usage and API costs at a glance — without opening a browser.

[![Latest Release](https://img.shields.io/github/v/release/DNSK-WORK/claude-usage-tool)](https://github.com/DNSK-WORK/claude-usage-tool/releases/latest)
[![Release Date](https://img.shields.io/github/release-date/DNSK-WORK/claude-usage-tool)](https://github.com/DNSK-WORK/claude-usage-tool/releases/latest)

---

## Why

If you're a heavy Claude user you've probably:
- Typed `/status` in Claude Code repeatedly just to check your limits
- Got blindsided by hitting a rate limit mid-session
- Had no idea how much you've spent on the API this month

**Claude Usage Tool** puts all of that in your menu bar. One click, always fresh.

---

## Features

- **Usage bars** — Current session (5hr), all models (7d), Sonnet-only, Opus-only, and extra usage limits, all with reset countdowns
- **Sparklines** — Tiny trend chart per bar showing the last 30 minutes of readings
- **Burn rate & ETA** — "~1hr 40min to limit · +5.2%/hr" calculated from live readings
- **API cost dashboard** — 30-day spend broken down by model, plus credit balance (requires Admin API key)
- **Telegram notifications** — Alerts when your session usage crosses 10% increments
- **In-app settings** — Configure Telegram credentials, alert thresholds, and refresh interval without touching config files
- **Menu bar only** — No dock icon, no clutter

---

## Quick Start

**Homebrew (recommended):**
```bash
brew tap DNSK-WORK/tap
brew install --cask claude-usage-tool
```

**Manual:**
Download the `.dmg` from [Releases](https://github.com/DNSK-WORK/claude-usage-tool/releases/latest), open it, drag to Applications.

**From source:**
```bash
git clone https://github.com/DNSK-WORK/claude-usage-tool.git
cd claude-usage-tool
npm install
npm run electron:dev
```

Click the icon that appears in your menu bar and log in to Claude when prompted.

---

## Configuration

### Telegram notifications (optional)

Open the **gear icon** in the app and enter your bot token and chat ID.
No `.env.local` editing needed.

To get a bot token: message [@BotFather](https://t.me/BotFather) → `/newbot`.
To get your chat ID: send a message to your bot, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates`.

### API cost dashboard (optional)

Requires an Anthropic Admin API key. Create `.env.local` in the project root:

```bash
ANTHROPIC_ADMIN_KEY=sk-ant-admin-your-key-here
```

A **Cost** tab will appear in the app showing 30-day spend by model and your credit balance.

> `.env.local` is gitignored — credentials won't be accidentally committed.

---

## Settings

Click the **⚙ gear icon** in the header to configure:

| Setting | Default | Description |
|---|---|---|
| Telegram Bot Token | — | Bot token from @BotFather |
| Telegram Chat ID | — | Your personal or group chat ID |
| Alert Thresholds | 80%, 90% | macOS notifications at these levels |
| Refresh Interval | 60s | How often usage data is fetched |

---

## Building

```bash
# Production .app
npm run electron:build
# → release/
```

Requires macOS. The built app is self-contained — no Node.js needed to run it.

---

## Project Structure

```
claude-usage-tool/
├── electron/
│   ├── main.ts        # App lifecycle, tray, refresh loop, settings store
│   ├── scraper.ts     # Fetches usage from claude.ai session API
│   ├── adminApi.ts    # Anthropic Admin API client (costs, tokens)
│   └── preload.ts     # Secure IPC bridge to renderer
└── src/
    ├── App.tsx                      # Shell: header, tabs, footer
    └── components/
        ├── ClaudeMaxUsage.tsx       # Usage bars, sparklines, ETA
        ├── CostDashboard.tsx        # API cost breakdown
        └── Settings.tsx             # Settings form
```

---

## Tech Stack

- **Electron** — desktop shell
- **React + TypeScript** — UI
- **Vite** — build tooling
- **electron-store** — persistent settings
- **electron-builder** — packaging

---

## Troubleshooting

**Login Required keeps appearing** — Click the refresh button. If it persists, click the tray icon → right-click → Login to Claude.

**Data not updating** — Open the Log panel at the bottom. Check for error messages. Make sure you have an internet connection.

**Port 5173 already in use** — Another Vite server is running. Kill it: `lsof -ti:5173 | xargs kill -9`

---

**Not affiliated with or endorsed by Anthropic.**
