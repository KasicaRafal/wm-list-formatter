# Warmachine List Formatter

Paste a Warmachine army list, format it, and copy the result.

- **Web UI:** open `index.html` in a browser (or serve the repo folder statically).
- **Discord bot:** see [Discord bot setup](#discord-bot-setup) below and [`bot/README.md`](bot/README.md).
- **Host at $0 (Oracle Always Free):** [`bot/deploy-oracle-always-free.md`](bot/deploy-oracle-always-free.md) — signup → home region → budget alert → Always Free VM → systemd.

Formatting logic lives in `formatter.js` and is shared by the web UI and the bot.

---

## Discord bot setup

The bot adds `/format` (paste modal by default) and a **Format list** message context menu. It replies with one main formatted **Output** message (or a `.txt` if too long).

### What you need from the Discord Developer Portal

You already have an application. You will copy **three** values (two required, one optional):

| Env var in `bot/.env` | Where to find it in the Portal / Discord |
| --- | --- |
| `DISCORD_TOKEN` | **Bot** → **Token** → **Reset Token** / **Copy** |
| `CLIENT_ID` | **General Information** → **Application ID** → **Copy** |
| `GUILD_ID` (optional) | Your Discord server → right-click server name → **Copy Server ID** (needs Developer Mode) |

No Privileged Gateway Intents are required for this bot (slash commands / modals / context menus).

---

### Step-by-step (beginner checklist)

#### 1. Open your application

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. Click your existing application

#### 2. Copy the Application ID → `CLIENT_ID`

1. Left sidebar: **General Information**
2. Find **Application ID**
3. Click **Copy**
4. Paste into `bot/.env` as `CLIENT_ID=...`

#### 3. Create / copy the Bot token → `DISCORD_TOKEN`

1. Left sidebar: **Bot**
2. If you do not see a bot user yet, click **Add Bot** / **Create Bot** and confirm
3. Under **Token**, click **Reset Token** (or **Copy** if shown), confirm, then **Copy** the token
4. Paste into `bot/.env` as `DISCORD_TOKEN=...`
5. **Treat this like a password.** Never commit it or paste it into the repo / PR / chat logs you do not control.

Optional on the same **Bot** page (recommended defaults for this project):

- **Public Bot**: off unless you want others to invite it
- **Privileged Gateway Intents**: leave **Message Content Intent**, **Server Members Intent**, and **Presence Intent** **off** — this bot does not need them

#### 4. Enable Developer Mode (only needed for `GUILD_ID`)

In the Discord app (not the Portal):

1. **User Settings** → **Advanced** → turn on **Developer Mode**
2. Right-click your test server’s name/icon → **Copy Server ID**
3. Paste into `bot/.env` as `GUILD_ID=...`

Using `GUILD_ID` makes `/format` appear in that server within seconds. Without it, global registration can take up to about an hour.

#### 5. Invite the bot to your server (OAuth2 URL)

1. Portal left sidebar: **OAuth2** → **URL Generator**
2. Under **Scopes**, check:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, check at least:
   - `Send Messages`
   - `Attach Files`
   - `Read Message History` (optional but useful)
4. Copy the **Generated URL** at the bottom
5. Open it in a browser, pick your server, authorize

You do **not** need Administrator permission for this bot.

#### 6. Create `bot/.env`

```bash
cd bot
cp .env.example .env
```

Edit `bot/.env`:

```env
DISCORD_TOKEN=paste_bot_token_here
CLIENT_ID=paste_application_id_here
GUILD_ID=paste_server_id_here
```

Leave `GUILD_ID` empty only if you intentionally want global commands.

#### 7. Install, register `/format`, and run

Requires Node.js 18+.

```bash
cd bot
npm install
npm run register
npm start
```

- `npm run register` clears and re-pushes `/format` + **Format list** (guild or global, depending on `GUILD_ID`).
- `npm start` keeps the bot online. Leave this terminal running.
- In Discord, type `/format` alone → paste box. Optional `file` for long `.txt` lists.

#### 8. Smoke-test the shared formatter (no Discord account needed)

```bash
cd bot
npm run test:formatter
```

---

### Bot usage

**Default (paste):**

1. Type `/format` with **no options** → Send
2. Paste box opens → paste the list → Submit

**Optional (long lists only):** `/format` + `file` (attach `.txt`)

**From a chat message:** right-click → **Apps → Format list**

**Reply:** one message with the main formatted Output (never WT on Discord).

**Limits:** paste modal ≤4000 chars. Longer → optional `file` (`.txt`).

---

### Project layout

| Path | Role |
| --- | --- |
| `index.html` / `style.css` / `script.js` | Web UI |
| `formatter.js` | Shared formatting logic |
| `bot/index.js` | Discord bot |
| `bot/commands.js` | Slash + context-menu definitions |
| `bot/register-commands.js` | Registers Discord commands |
| `bot/.env.example` | Env template (no secrets) |

---

### Host on Oracle Cloud Always Free ($0)

To keep the bot online 24/7 at zero cost, use Oracle Cloud **Always Free** (Ampere A1 or AMD micro) and follow the from-zero guide:

**→ [`bot/deploy-oracle-always-free.md`](bot/deploy-oracle-always-free.md)**

Order matters: account signup → permanent home region → budget / $0 alert → only then create an Always Free-eligible VM → install Node + systemd. Stay-free pitfalls (paid shapes, extra volumes, paid IPs) are listed at the top of that doc.

### Security

- Never commit `bot/.env` or real tokens.
- If a token leaks, go to Portal → **Bot** → **Reset Token** immediately and update `bot/.env`.
