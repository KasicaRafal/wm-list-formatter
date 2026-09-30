# Host the Discord bot on Oracle Cloud Always Free ($0)

This guide is for a **brand-new** Oracle Cloud account. Follow the order below: signup → home region → budget safeguards → Always Free VM → install the bot. Do **not** create a VM until budgets/alerts are in place.

Official Always Free limits change over time. Before you click Create, confirm shapes against Oracle’s docs: [Always Free Resources](https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm). As of late 2025 / 2026, typical Always Free compute is:

| Shape | Notes |
| --- | --- |
| **`VM.Standard.A1.Flex` (Ampere / Arm)** — prefer this | Up to **2 OCPU + 12 GB RAM** total per tenancy (Always Free). Enough for this Discord bot at **1 OCPU / 6 GB** (or less). |
| **`VM.Standard.E2.1.Micro` (AMD)** | Up to **two** Always Free micro VMs. Fine fallback if Ampere has no capacity. |

Always Free compute **must** be created in your **home region**.

---

## Stay free — read this before anything else

Oracle Free Tier signup often asks for a card for identity checks. That does **not** mean you should create paid resources. Charges come from **what you provision**, not from “having an account.”

### Do **not** click / do **not** create

| Pitfall | Why it costs money |
| --- | --- |
| Any shape **without** “Always Free-eligible” | Paid compute. |
| Ampere A1 with **more than** the Always Free OCPU/RAM cap (e.g. above 2 OCPU / 12 GB) | Usage above the free allocation is billable. |
| **Non-home region** VMs | Always Free compute is home-region only. |
| **Extra block volumes** beyond the boot volume you need | Boot volume counts toward the ~200 GB Always Free storage; extra volumes burn the quota or bill. Keep boot ~47–50 GB unless you know you need more. |
| **Reserved / paid public IPs**, load balancers, extra VNICs you did not plan | Networking add-ons can bill. Use the default ephemeral public IPv4 on the instance. |
| **Databases, Kubernetes, GPU, paid OS images** | Not needed for this bot; often paid. |
| **Preemptible** capacity as a “free” trick | Not Always Free-eligible for this use case — stick to on-demand Always Free-eligible. |
| Ignoring **Cost Analysis** / skipping a **budget alert** | Accidental paid resources can sit unnoticed. |

### Do this instead

1. Only create resources marked **Always Free-eligible**.
2. Prefer **one** small Ampere A1 (or one AMD micro) in the **home region**.
3. Set a **budget + email alert** immediately after signup (next section), **before** the VM.
4. This Discord bot only needs **outbound** HTTPS to Discord. You do **not** need open inbound ports for Discord. Keep inbound to **SSH (22)** from your IP if possible.

---

## Phase 0 — First 3 steps (do these now)

You are signing up with **no Oracle account yet**. Right now:

1. **Sign up** at [https://www.oracle.com/cloud/free/](https://www.oracle.com/cloud/free/) (or cloud.oracle.com → Start for free). Complete email / phone / card verification if asked. Card verification ≠ automatic charges.
2. **Pick your Home Region carefully** — it is **permanent** for Always Free. Choose a region close to you (or where you are fine SSHing from). You cannot move Always Free compute to another region later.
3. **Set a budget alert (aim for $0 / lowest allowed)** — see Phase 2 — **before** creating any Compute instance.

When those three are done, come back for Phase 3 (VM) and Phase 4 (bot).

---

## Phase 1 — Account signup notes

1. Use a real email you check; Oracle sends capacity and billing notices there.
2. Complete identity verification. A credit/debit card is commonly required for fraud checks.
3. After the tenancy is ready, sign in to the **OCI Console**.
4. Confirm you are viewing your **home region** (region picker in the console header). Always Free VMs go here only.

**Free Trial vs Always Free:** New accounts often get a time-limited trial credit **and** Always Free resources. Trial credits can make it easier to get capacity, but **trial ≠ forever free**. Anything outside Always Free limits can bill after credits end. Treat every Create dialog as “will this stay Always Free?”

---

## Phase 2 — Budget / $0 safeguards (do this before the VM)

Budgets do **not** hard-block every charge in real time, but they are the best early warning Oracle still offers.

1. Console → **Billing & Cost Management** → **Budgets** (wording may be **Cost Management** → **Budgets**).
2. Create a budget for the root / your main compartment.
3. Set the amount to **`0`** if the UI allows it. If Oracle requires a positive amount, use the **lowest allowed** (often **`$1`**).
4. Add an alert rule:
   - Threshold: **100%** of budget (and optionally **80%** if available).
   - Prefer both **Actual** and **Forecast** spend if offered.
   - Email: an address you read.
5. Optional hardening: enable **Cost Anomaly Detection** if shown in Cost Management.
6. Bookmark **Billing → Cost Analysis** and check it after you create the VM (expect ~$0 for Always Free-only usage; small delays in reporting are normal).

**Important:** Budget alerts can lag (often evaluated on a daily cycle). They are a safety net, not a kill switch. The real protection is **never creating paid shapes / extra volumes / paid IPs**.

---

## Phase 3 — Create one Always Free VM

### 3.1 Networking (defaults are fine)

On first Compute create, accept Oracle’s default VCN/subnet wizard if offered (or create a simple VCN in the home region). You only need:

- A public subnet (or a private subnet + public IP path you understand).
- Security list / NSG allowing **inbound TCP 22** (SSH) from **your IP** (better than `0.0.0.0/0`).
- **No** need to open Discord ports inbound. The bot dials **out** to Discord.

### 3.2 Create Compute instance

1. **Compute → Instances → Create instance**.
2. Name: e.g. `wm-list-formatter-bot`.
3. **Placement:** home region only. If Ampere fails with “Out of host capacity,” try another **availability domain**, wait and retry, or use **AMD micro** (`VM.Standard.E2.1.Micro`) instead. Do **not** “fix” it by picking a paid shape.
4. **Image:** Canonical **Ubuntu** 22.04 or 24.04 (Always Free-eligible). Avoid specialty/paid images.
5. **Shape:**
   - Prefer **Ampere** → **`VM.Standard.A1.Flex`**.
   - Set **1 OCPU** and **6 GB** memory (plenty for this bot; stays under the Always Free A1 pool).
   - Confirm the UI shows **Always Free-eligible**.
   - Fallback: **AMD** → **`VM.Standard.E2.1.Micro`**.
6. **Networking:** assign a **public IPv4** (ephemeral / default). Do **not** add a reserved public IP unless you know it is free in your tenancy.
7. **SSH keys:** paste your **public** key (`.pub`). Save the private key offline. Without this you cannot log in.
8. **Boot volume:** leave default size near the minimum (~47–50 GB). Do **not** attach extra block volumes.
9. Review the summary for **Always Free-eligible**, then **Create**.

Wait until the instance state is **Running**. Copy the **public IP**.

### 3.3 SSH in

On Ubuntu images the default user is usually `ubuntu`:

```bash
ssh -i /path/to/your_private_key ubuntu@YOUR_PUBLIC_IP
```

---

## Phase 4 — Install Node, get the bot, configure, run

### 4.1 System packages + Node.js 20+

```bash
sudo apt update
sudo apt install -y git curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # expect v20+
npm -v
```

(Node **18+** is required by `bot/package.json`; 20 LTS is a good default.)

### 4.2 Clone the repo (or copy `bot/` + `formatter.js`)

The bot imports shared logic from repo-root `formatter.js`, so you need **both** `bot/` and `formatter.js` (full clone is simplest):

```bash
cd ~
git clone https://github.com/KasicaRafal/wm-list-formatter.git
cd wm-list-formatter
# If you deploy from PR #2 before merge:
# git fetch origin cursor/discord-formatter-bot-a4b4 && git checkout cursor/discord-formatter-bot-a4b4
cd bot
npm install
```

### 4.3 Create `.env` (never commit secrets)

```bash
cp .env.example .env
nano .env   # or vim / whatever you prefer
```

Fill (same keys as `.env.example`):

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id_optional
```

| Variable | Source |
| --- | --- |
| `DISCORD_TOKEN` | Discord Developer Portal → App → **Bot** → Token |
| `CLIENT_ID` | Portal → **General Information** → Application ID |
| `GUILD_ID` | Optional. Server ID for instant slash-command registration |

- `bot/.env` is gitignored. **Never** commit it or paste tokens into the repo / PR.
- If a token leaks: Portal → **Bot** → **Reset Token**, then update `.env`.

Root Discord setup details: [../README.md](../README.md#discord-bot-setup).

### 4.4 Register slash commands, then start once

```bash
cd ~/wm-list-formatter/bot
npm run register
npm start
```

In Discord, try `/format`. If it works, stop the foreground process (`Ctrl+C`) and switch to systemd.

### 4.5 Run with systemd (survives reboot)

An example unit is in [`deploy/wm-list-formatter-bot.service`](deploy/wm-list-formatter-bot.service). Adjust `User=`, paths, and `EnvironmentFile=` if your home directory or username differs.

```bash
sudo cp ~/wm-list-formatter/bot/deploy/wm-list-formatter-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wm-list-formatter-bot
sudo systemctl status wm-list-formatter-bot
journalctl -u wm-list-formatter-bot -f
```

### 4.6 Firewall notes

- **OCI Security List / NSG:** inbound **22/tcp** for SSH; no Discord inbound rules required.
- **OS firewall (`ufw`)** if you enable it:

```bash
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status
```

Outbound HTTPS (443) to Discord must remain allowed (default).

---

## Updates later

```bash
cd ~/wm-list-formatter
git pull
cd bot
npm install
npm run register   # only if command definitions changed
sudo systemctl restart wm-list-formatter-bot
```

---

## Quick checklist

- [ ] Account created; **home region** chosen on purpose
- [ ] Budget alert at **$0** or lowest allowed + email
- [ ] One **Always Free-eligible** VM (Ampere A1 within free OCPU/RAM, or AMD micro)
- [ ] No extra block volumes / paid IPs / paid shapes
- [ ] Node 18+ installed; repo cloned; `bot/.env` filled locally
- [ ] `npm run register` + systemd service running
- [ ] Cost Analysis still ~$0 after a day

If anything in Cost Analysis is non-zero and you did not intend a paid resource, stop/terminate the unexpected resource and re-check shape / volumes / IPs against Always Free.
