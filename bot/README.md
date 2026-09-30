# Discord bot — Warmachine List Formatter

Slash command `/format` (paste modal by default) and a **Format list** message context menu. Replies with the main formatted **Output** only (never WT on Discord).

Shared formatting lives in repo-root [`formatter.js`](../formatter.js).

## Quick start (local)

Requires Node.js 18+.

```bash
cd bot
cp .env.example .env
# Edit .env — see ../README.md#discord-bot-setup for Portal steps
npm install
npm run register
npm start
```

Env keys (no secrets in git):

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token |
| `CLIENT_ID` | yes | Application ID |
| `GUILD_ID` | no | Instant guild command registration while testing |

Template: [`.env.example`](.env.example). Never commit `.env`.

## Host on Oracle Cloud Always Free ($0)

Step-by-step from **zero account** → home region → budget safeguards → Always Free VM → systemd:

**→ [deploy-oracle-always-free.md](deploy-oracle-always-free.md)**

Example systemd unit: [`deploy/wm-list-formatter-bot.service`](deploy/wm-list-formatter-bot.service).

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Run the bot |
| `npm run register` | Clear + re-register `/format` and **Format list** |
| `npm run test:formatter` | Offline formatter smoke tests |

## Security

- Keep tokens only in `bot/.env` on the machine that runs the bot.
- If a token leaks: Discord Developer Portal → **Bot** → **Reset Token**.
