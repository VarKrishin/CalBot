# How to test the Telegram bot locally

Follow these steps **in order**. You need your app running, ngrok running, and Telegram pointed at your ngrok URL.

---

## Step 1 — Start your app

In a terminal at the project root:

```bash
pnpm run dev
```

**Leave it running.** You should see: `Ready on http://localhost:8787`.

---

## Step 2 — Start ngrok

Open a **second** terminal. Run:

```bash
./scripts/ngrok-dev.sh
```

**Leave it running.** You'll see a line like:

```
Forwarding    https://something-random.ngrok-free.app -> http://localhost:8787
```

**Copy that full HTTPS URL** (e.g. `https://something-random.ngrok-free.app`).  
Don't close this terminal — if you close ngrok, Telegram can't reach your app.

---

## Step 3 — Set the webhook (tell Telegram where to send messages)

Open a **third** terminal (or a new tab). Run this **once**, with your real values:

```bash
curl -X POST "http://localhost:8787/admin/telegram-set-webhook" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"baseUrl": "https://YOUR_NGROK_URL"}'
```

Replace:

- **YOUR_ADMIN_SECRET** — value of `ADMIN_SECRET` in your `.dev.vars` file.
- **YOUR_NGROK_URL** — the ngrok host only, e.g. `something-random.ngrok-free.app` (no `https://` inside the quotes is fine; the app adds it).

Example (fake values):

```bash
curl -X POST "http://localhost:8787/admin/telegram-set-webhook" \
  -H "Authorization: Bearer 19f2aa24d76a57e8adf5f9ca33b2e058" \
  -H "Content-Type: application/json" \
  -d '{"baseUrl": "https://unsectionalised-exploratively-jennifer.ngrok-free.app"}'
```

You should get a response like: `{"ok":true,"webhookUrl":"https://.../api/telegram/webhook"}`.

---

## Step 4 — Test in Telegram

1. Open **Telegram** and search for your bot (the name you gave it in BotFather).
2. Send: **`/start`**  
   → You should get a welcome message from the bot.
3. Send: **`2 eggs for breakfast`** (or any meal)  
   → You should get a reply with calories logged.

---

## Step 5 — Verify ngrok is reaching your app

**Before** sending a message in Telegram, confirm the app is reachable through ngrok:

1. With **ngrok** and **pnpm run dev** both running, open in your **browser**:
   ```text
   https://YOUR_NGROK_URL/api/telegram/webhook
   ```
   (Use the same ngrok URL you used in Step 3.)

2. You should see plain text: **`CalBot webhook OK — POST here from Telegram`**.

3. In the **pnpm run dev** terminal you should see: `GET /api/telegram/webhook 200 OK`.

If you **don’t** see that page or that log line, ngrok isn’t reaching your app (wrong port, ngrok not running, or wrong URL). Fix that first, then run Step 3 again to set the webhook to the **current** ngrok URL.

---

## Step 6 — If the bot still doesn’t respond

**Watch the terminal where `pnpm run dev` is running.**

When you send a message in Telegram you should see:

- `[telegram] webhook update_id=12345`
- `POST /api/telegram/webhook 200 OK`

| What you see | What it means |
|--------------|----------------|
| **Nothing** when you send a message | Telegram isn’t reaching your app. Is ngrok still running? Did the ngrok URL change? Run Step 3 again with the **current** ngrok URL. |
| **You see the log lines** but no reply in Telegram | The app got the message but something failed (e.g. missing env, sendMessage error). Look for **red error lines** in the same terminal. |

---

## When you're done testing

To stop Telegram from sending updates to your machine:

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/deleteWebhook"
```

Replace `YOUR_BOT_TOKEN` with your `TELEGRAM_BOT_TOKEN` from `.dev.vars`.
