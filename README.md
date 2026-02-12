# CalBot – Nutrition Tracker

Telegram bot that logs natural-language food entries to Google Sheets. Send what you ate (e.g. "2 eggs for breakfast"); the bot parses it, matches foods to a reference table (R1 in Cloudflare D1), and appends rows to a Daily Tracker sheet. The **Nutrition** sheet (Google Sheets) holds API-learned foods; **R1** (reference foods) lives in Cloudflare D1.

## Setup

### 1. Install and run locally

```bash
pnpm install
pnpm run dev
```

`pnpm run dev` runs with `--remote`, so D1 and other bindings use the **cloud** (no local D1).

### 2. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| **TELEGRAM_BOT_TOKEN** | Yes | From [@BotFather](https://t.me/BotFather) |
| **GOOGLE_SERVICE_ACCOUNT_EMAIL** | Yes | Service account email (e.g. `xxx@project.iam.gserviceaccount.com`) |
| **GOOGLE_PRIVATE_KEY** | Yes | Full PEM private key from JSON key (newlines as `\n` or as-is) |
| **NUTRITION_SHEET_ID** | Yes | Spreadsheet ID that has the **Nutrition** tab (Food item, Unit, Quantity, Calories, Protein, Fat, Carb, Vitamin profile) |
| **TRACKER_SHEET_ID** | Yes | Spreadsheet ID for Daily Tracker (can be same as NUTRITION_SHEET_ID; tracker tabs `YYYY-MM_Tracker` are created automatically) |
| **FATSECRET_CLIENT_ID** | No | [FatSecret Platform](https://platform.fatsecret.com/register) – for unknown foods |
| **FATSECRET_CLIENT_SECRET** | No | FatSecret client secret |
| **NUTRITIONIX_APP_ID** / **NUTRITIONIX_API_KEY** | No | Alternative to FatSecret for unknown foods |
| **ADMIN_SECRET** | No | Protects `POST /admin/sync`, `POST /admin/sync-vectorize`, and `POST /admin/seed-r1` |

**R1 (reference foods)** is stored in **Cloudflare D1**, not in a sheet. See “D1 (R1) setup” below.

- **Local dev:** Copy `.dev.vars.example` to `.dev.vars`, fill in values. Wrangler loads `.dev.vars` for `pnpm run dev`. Do not commit `.dev.vars`.
- **Production:** Set secrets in Cloudflare: `pnpm exec wrangler secret put <NAME>` for each, or use Cloudflare Dashboard → Workers → your worker → Settings → Variables and Secrets.

### 3. D1 (R1) setup – reference foods

Reference foods (R1) live in **Cloudflare D1**:

1. Create the D1 database and get its ID:
   ```bash
   pnpm exec wrangler d1 create calbot-r1
   ```
2. In `wrangler.jsonc`, set `database_id` under `d1_databases` to the ID from the output (replace `REPLACE_AFTER_D1_CREATE`).
3. Apply the schema in the cloud (dev runs with `--remote`, so only remote migrations are needed):
   ```bash
   pnpm exec wrangler d1 execute calbot-r1 --remote --file=./migrations/0000_r1_foods.sql
   pnpm exec wrangler d1 execute calbot-r1 --remote --file=./migrations/0001_sync_tables.sql
   ```
4. Seed R1 (e.g. from your Nutrition sheet or a JSON array). Example:
   ```bash
   curl -X POST "https://<your-worker>.workers.dev/admin/seed-r1" \
     -H "Authorization: Bearer <ADMIN_SECRET>" \
     -H "Content-Type: application/json" \
     -d '[{"name":"Egg","unit":"n","quantity":1,"calories":78,"protein":6,"fat":5,"carbs":1}]'
   ```
   Or use the same structure as your Nutrition sheet: `name`, `unit`, `quantity`, `calories`, `protein`, `fat`, `carbs`, optional `vitamins`.

### 4. Google spreadsheet (Nutrition + Tracker)

1. Create a Google Cloud project, enable **Google Sheets API**.
2. Create a **Service account**, download JSON key. Use `client_email` and `private_key` for the secrets above.
3. Create a spreadsheet (or use one) with:
   - A sheet tab named **Nutrition** – columns: Food item (A), Unit (B), Quantity (C), Calories (D), Protein (E), Fat (F), Carbohydrate (G), Vitamin profile (H). Row 1 = headers; used for API-learned foods.
   - Tracker tabs are created automatically as `YYYY-MM_Tracker` when you log the first entry of the month.
4. Share the spreadsheet with the **service account email** (Editor access). Use this spreadsheet’s ID for both **NUTRITION_SHEET_ID** and **TRACKER_SHEET_ID** (same workbook).

**Keeping Sheets and D1 in sync (per design):** Run the admin sync so D1 has a mirror of your Nutrition and Tracker data. After applying the second migration (`0001_sync_tables.sql`), call:
```bash
curl -X POST "https://<your-worker>.workers.dev/admin/sync" \
  -H "Authorization: Bearer <ADMIN_SECRET>"
```
This pulls the Nutrition sheet and current month’s Tracker sheet into D1. Re-run after you edit the sheets if you want D1 updated.

### 5. Telegram webhook (after deploy)

After `pnpm run deploy`, set the webhook so Telegram sends updates to your worker:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<your-worker>.<account>.workers.dev/webhook"}'
```

Replace `<YOUR_BOT_TOKEN>` and the worker URL. The worker URL is shown after `pnpm run deploy`.

### 6. Deploy

```bash
pnpm run deploy
```

## Phase 2: Vectorize and unknown foods

- **Vectorize:** Create the index and sync R1 (from D1) + Nutrition (from Sheets) data:
  ```bash
  pnpm run vectorize:create
  ```
  Then add the Vectorize binding to `wrangler.jsonc` (uncomment the `vectorize` block), redeploy, and sync from the worker:
  ```bash
  curl -X POST "https://<your-worker>.workers.dev/admin/sync-vectorize" \
    -H "Authorization: Bearer <ADMIN_SECRET>"
  ```
  Set `ADMIN_SECRET` via `pnpm exec wrangler secret put ADMIN_SECRET` to protect the endpoint.
- **Unknown foods:** Set **FATSECRET_CLIENT_ID** and **FATSECRET_CLIENT_SECRET** ([FatSecret Platform](https://platform.fatsecret.com/register)); or **NUTRITIONIX_APP_ID** and **NUTRITIONIX_API_KEY**. Unknown foods are looked up and appended to the **Nutrition** sheet.
- **Voice:** Send a voice message; it is transcribed with Whisper and processed like text.

## Coach visibility

Share the Tracker spreadsheet with your coach’s Google account (Viewer access). They will see all `YYYY-MM_Tracker` sheets. You can add a daily total row or conditional formatting in the sheet per your goals.

## Tests

```bash
pnpm test
```

Unit tests cover match logic (R1 resolution, scaling) and quantity/unit conversion. Use `pnpm run test:watch` during development.

## Generate types from Wrangler config

```bash
pnpm run cf-typegen
```

Use the generated `CloudflareBindings` (or the project’s `Env` type) as Hono bindings.
