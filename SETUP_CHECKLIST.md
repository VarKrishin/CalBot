# What you need to do

Run these from the project root (`CalBot/`). Use **pnpm** (or **npx**) so Wrangler runs from the project—don’t call `wrangler` directly unless it’s installed globally.

---

## Where to put env values

| Use case | Where | How |
|----------|--------|-----|
| **Local dev** (`pnpm run dev`) | `.dev.vars` in project root | Copy `.dev.vars.example` to `.dev.vars`, fill in values. Dev uses **remote** D1 (cloud). File is gitignored. |
| **Production** (deployed worker) | **Cloudflare** (secrets) | `pnpm exec wrangler secret put <NAME>` for each variable. Not in repo. |

Do **not** commit `.dev.vars` or put production secrets in the repo. Use **Cloudflare Dashboard** → Workers & Pages → your worker → Settings → Variables and Secrets to view or add secrets there if you prefer over the CLI.

---

## 1. Install dependencies

```bash
pnpm install
```

---

## 2. D1 (R1 reference foods)

1. Create the D1 database:
   ```bash
   pnpm exec wrangler d1 create calbot-r1
   ```
2. In `wrangler.jsonc`, replace `REPLACE_AFTER_D1_CREATE` (under `d1_databases`) with the **database_id** from the command output.
3. Apply the schema in the cloud (dev uses `--remote`, so no local D1):
   ```bash
   pnpm exec wrangler d1 execute calbot-r1 --remote --file=./migrations/0000_r1_foods.sql
   pnpm exec wrangler d1 execute calbot-r1 --remote --file=./migrations/0001_sync_tables.sql
   ```
4. After deploy, seed R1 via `POST /admin/seed-r1` (see step 8) or add rows manually with D1 Studio / SQL.

## 3. Google Cloud & spreadsheet (Nutrition + Tracker)

1. Create a [Google Cloud project](https://console.cloud.google.com/) and enable **Google Sheets API**.
2. Create a **Service account** (IAM → Service accounts → Create). Download its **JSON key**.
3. Create a **Google Sheet** (or use an existing one):
   - Add a sheet tab named **Nutrition**. Row 1: `Food item`, `unit of measurement`, `quantity`, `Calories`, `Protein`, `Fat`, `Carbohydrate`, `Vitamin Profile`. Data from row 2 (API-learned foods and/or your reference list).
   - Tracker tabs (`YYYY-MM_Tracker`) are created automatically when you log the first entry of the month.
4. **Share** the spreadsheet with the service account **email** (from the JSON key) as **Editor**.

---

## 4. Telegram bot

1. In Telegram, open [@BotFather](https://t.me/BotFather) and create a bot with `/newbot`. Copy the **token**.
2. (Webhook is set in step 6 after deploy.)

---

## 5. FatSecret (recommended for unknown foods)

1. Register at [FatSecret Platform](https://platform.fatsecret.com/register) and create an application.
2. Copy **Client ID** and **Client Secret** (secret is shown once).
3. Add them as secrets in step 5 (or in `.dev.vars` for local dev).

If you don’t set FatSecret, you can optionally use **Nutritionix** (NUTRITIONIX_APP_ID, NUTRITIONIX_API_KEY) instead; otherwise unknown foods get a generic estimate.

---

## 6. Set env / secrets

**Local dev:** Copy `.dev.vars.example` to `.dev.vars` and fill in every value you need. Then `pnpm run dev` will read them.

**Production:** From the project root, run for each (paste the value when prompted):

```bash
pnpm exec wrangler secret put TELEGRAM_BOT_TOKEN
pnpm exec wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
pnpm exec wrangler secret put GOOGLE_PRIVATE_KEY
pnpm exec wrangler secret put NUTRITION_SHEET_ID
pnpm exec wrangler secret put TRACKER_SHEET_ID
```

- **GOOGLE_PRIVATE_KEY:** Paste the full `private_key` from the JSON key (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`). Keep newlines as-is or use `\n` if the tool expects one line.
- **NUTRITION_SHEET_ID / TRACKER_SHEET_ID:** From the spreadsheet URL `https://docs.google.com/spreadsheets/d/<THIS_IS_THE_ID>/edit`. Use the **same ID** for both if Nutrition and Tracker tabs are in one spreadsheet. The **Nutrition** tab holds API-learned foods (columns: Food item, Unit, Quantity, Calories, Protein, Fat, Carb, Vitamin profile).

Optional (unknown foods and admin):

```bash
pnpm exec wrangler secret put FATSECRET_CLIENT_ID
pnpm exec wrangler secret put FATSECRET_CLIENT_SECRET
# Or Nutritionix instead:
# pnpm exec wrangler secret put NUTRITIONIX_APP_ID
# pnpm exec wrangler secret put NUTRITIONIX_API_KEY
pnpm exec wrangler secret put ADMIN_SECRET
```

---

## 7. Deploy and set Telegram webhook

```bash
pnpm run deploy
```

Note the worker URL (e.g. `https://calbot.<your-subdomain>.workers.dev`). Then set the webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://calbot.<your-subdomain>.workers.dev/webhook"}'
```

Replace `<YOUR_BOT_TOKEN>` and the worker host with your values.

---

## 8. Seed R1 (reference foods in D1)

If you haven’t already, add reference foods to D1 so the bot can match entries (e.g. “2 eggs” → Egg from R1). Option A: call the seed endpoint with a JSON array (set `ADMIN_SECRET` first):

```bash
curl -X POST "https://calbot.<your-subdomain>.workers.dev/admin/seed-r1" \
  -H "Authorization: Bearer <YOUR_ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '[{"name":"Egg","unit":"n","quantity":1,"calories":78,"protein":6,"fat":5,"carbs":1},{"name":"Steel cut oats","unit":"cup","quantity":0.25,"calories":38,"protein":1.3,"fat":0.7,"carbs":6.5}]'
```

Option B: use the same structure as your Nutrition sheet and export rows to JSON, or add rows in Cloudflare Dashboard → D1 → calbot-r1 → Console (SQL).

---

## 9. Sync Sheets → D1 (per design)

To keep Google Sheets and D1 in sync (Nutrition + Tracker mirror in D1), run after deploy:

```bash
curl -X POST "https://calbot.<your-subdomain>.workers.dev/admin/sync" \
  -H "Authorization: Bearer <YOUR_ADMIN_SECRET>"
```

```bash
curl -X POST "http://localhost:8787/admin/sync" \
  -H "Authorization: Bearer <YOUR_ADMIN_SECRET>"
```
```
curl -X POST "http://localhost:8787/admin/sync-vectorize" \
     -H "Authorization: Bearer <YOUR_ADMIN_SECRET>"
```

This pulls the Nutrition sheet and current month’s Tracker sheet into D1. Re-run whenever you edit the sheets and want D1 updated.

---

## 10. Vectorize (optional, for fuzzy food matching)

Only if you want semantic search (e.g. “chappati” → “Chapati”):

1. Create the index (1024 dimensions to match the embedding model):
   ```bash
   pnpm run vectorize:create
   ```
   **If you see "expected 512 dimensions, got 1024":** delete the old index and recreate, then re-sync (step 4):
   ```bash
   pnpm exec wrangler vectorize delete nutrition-foods
   pnpm run vectorize:create
   ```
2. In **wrangler.jsonc**, uncomment the `vectorize` block (add the `"vectorize": [{ "binding": "VECTORIZE", "index_name": "nutrition-foods" }]` line after the `ai` block).
3. Redeploy:
   ```bash
   pnpm run deploy
   ```
4. Sync R1 + Nutrition into the index (use your worker URL and `ADMIN_SECRET`):
   ```bash
   curl -X POST "https://calbot.<your-subdomain>.workers.dev/admin/sync-vectorize" \
     -H "Authorization: Bearer <YOUR_ADMIN_SECRET>"
   ```

---

## 11. Test the bot

In Telegram, open your bot and send:

- `/start` — welcome message
- `2 eggs for breakfast` — should log to the Tracker sheet (if “Egg” is in R1 in D1)

Check the spreadsheet for a new sheet like `2026-02_Tracker` and the new rows.

---

## Quick reference

| Task              | Command |
|-------------------|--------|
| Local dev         | `pnpm run dev` |
| Deploy            | `pnpm run deploy` |
| Run tests         | `pnpm test` |
| Create Vectorize  | `pnpm run vectorize:create` |
| Any wrangler cmd  | `pnpm exec wrangler <...>` |
