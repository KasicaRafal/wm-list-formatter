# Discord bot — Warmachine List Formatter

Slash command `/format` (paste modal by default) and a **Format list** message context menu. Replies with the main formatted **Output** only (never WT on Discord).

Shared formatting lives in repo-root [`formatter.js`](../formatter.js).

## Recommended: run with Docker (local)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) or Docker Engine + Compose (Linux).

```bash
cd bot
cp .env.example .env
# Edit .env — DISCORD_TOKEN, CLIENT_ID, optional GUILD_ID
# Portal steps: ../README.md#discord-bot-setup

docker compose run --rm bot npm run register
docker compose up -d
```

- **Logs:** `docker compose logs -f`
- **Stop:** `docker compose down`
- Secrets stay in `bot/.env` (Compose `env_file`). Nothing is baked into the image.

Env keys (no secrets in git):

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token |
| `CLIENT_ID` | yes | Application ID |
| `GUILD_ID` | no | Instant guild command registration while testing |

Template: [`.env.example`](.env.example). Never commit `.env`.

### Windows (PowerShell / CMD)

Same commands from `bot\` after Docker Desktop is running. Example PowerShell:

```powershell
cd bot
copy .env.example .env
# Edit .env in Notepad / your IDE, then:
docker compose run --rm bot npm run register
docker compose up -d
```

## Optional: run with Node locally

Requires Node.js 18+.

```bash
cd bot
cp .env.example .env
npm install
npm run register
npm start
```

## Hosting (optional / deferred)

**Oracle Always Free is deferred** for now — prefer keeping the bot on your machine with Docker.

The older guide remains for later if you want 24/7 cloud hosting:

**→ [deploy-oracle-always-free.md](deploy-oracle-always-free.md)** (optional, not required)

Example systemd unit (Oracle/VM path only): [`deploy/wm-list-formatter-bot.service`](deploy/wm-list-formatter-bot.service).

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` / Compose default | Run the bot |
| `npm run register` | Clear + re-register `/format` and **Format list** |
| `npm run test:formatter` | Offline formatter smoke tests |

## Security

- Keep tokens only in `bot/.env` on the machine that runs the bot.
- If a token leaks: Discord Developer Portal → **Bot** → **Reset Token**.
