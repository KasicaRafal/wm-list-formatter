# Warmachine List Formatter

Paste a Warmachine army list, format it, and copy the result.

- **Web UI:** open `index.html` in a browser (or serve the repo folder statically).
- **Discord bot:** see [Discord bot setup](#discord-bot-setup) below.

Formatting logic lives in `formatter.js` and is shared by the web UI and the bot.

---

## Discord bot setup

The bot adds a `/format` slash command. You can paste the list into the `list` option, or attach a `.txt` file with the `file` option when the list is too long. It replies with the same two results as the web app: **Output** and **Output for WT**. Long replies are sent as `.txt` attachments.

English replies and the `/format` command name match the web UI.

### What you need from the Discord Developer Portal

You already have an application. You will copy **three** values (two required, one optional):

| Env var in `bot/.env` | Where to find it in the Portal / Discord |
| --- | --- |
| `DISCORD_TOKEN` | **Bot** → **Token** → **Reset Token** / **Copy** |
| `CLIENT_ID` | **General Information** → **Application ID** → **Copy** |
| `GUILD_ID` (optional) | Your Discord server → right-click server name → **Copy Server ID** (needs Developer Mode) |

No Privileged Gateway Intents are required for this bot (it only uses slash commands).

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

- `npm run register` pushes the `/format` command to Discord (guild or global, depending on `GUILD_ID`).
- `npm start` keeps the bot online. Leave this terminal running.
- In Discord, type `/format` and either fill `list` or attach a `.txt` via `file`.

#### 8. Smoke-test the shared formatter (no Discord account needed)

```bash
cd bot
npm run test:formatter
```

---

### Bot usage

```
/format list:<paste list here>
/format file:<attach .txt>
```

You can provide either option. If both are present, the attached file is used.

Replies:

1. **Output** — same as the web app’s main output (Discord code block)
2. **Output for WT** — same as the web app’s WT output

If a result is longer than Discord’s message limit (2000 characters), the bot sends it as a `.txt` file attachment instead.

---

### Project layout

| Path | Role |
| --- | --- |
| `index.html` / `style.css` / `script.js` | Web UI |
| `formatter.js` | Shared formatting logic |
| `bot/index.js` | Discord bot |
| `bot/register-commands.js` | Registers `/format` |
| `bot/.env.example` | Env template (no secrets) |

---

### Security

- Never commit `bot/.env` or real tokens.
- If a token leaks, go to Portal → **Bot** → **Reset Token** immediately and update `bot/.env`.
