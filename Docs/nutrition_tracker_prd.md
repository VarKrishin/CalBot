# Product Requirements Document: Nutrition Tracking Bot

**Version:** 1.0  
**Date:** February 3, 2026  
**Owner:** Product Team  
**Status:** Ready for Development

---

## Executive Summary

A zero-friction Telegram nutrition tracking bot that converts natural language food entries into structured Google Sheets logs. Users simply text or voice message what they ate; the system autonomously resolves nutrition data and logs it—never asking for clarification.

---

## Product Vision

Enable effortless nutrition tracking through conversational input, eliminating manual spreadsheet updates while maintaining full visibility for user and coach. The bot operates as an intelligent assistant that handles 100% of nutrition lookups automatically.

---

## Problem Statement

**Current State:**
- Manual nutrition tracking creates friction and abandonment
- Users hate tedious data entry with multiple taps/screens
- Coaches lack real-time visibility into client adherence
- Existing apps require structured input formats

**Impact:**
- 70%+ dropout rate on nutrition tracking apps
- Coaches can't intervene when clients drift off-plan
- Users under-report or forget meals

---

## Proposed Solution

Telegram bot that accepts natural language input like:
- "2 chapatis, protein shake, 1 cup sambar for breakfast"
- "ghee podi dosa from restaurant"
- "amul ice cream 100ml"

The bot autonomously:
1. Parses food items, quantities, and meal timing
2. Searches R1 nutrition reference table via vector similarity
3. Falls back to Nutritionix API for unknown foods
4. Stores new foods in Nutrition table for future use
5. Updates Daily Tracker sheet with nutritional breakdown
6. Returns confirmation with calorie/protein totals

**Key Principle:** Zero user friction—never ask for clarification or missing data.

---

## Technical Architecture

### System Diagram

```
┌─────────────┐
│  Telegram   │ Text/Voice messages
│   (User)    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│     Cloudflare Worker (Hono.js Framework)       │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ 1. Webhook Handler                        │ │
│  │    - Receive Telegram message             │ │
│  │    - Detect message type (text/voice)     │ │
│  └───────────────┬───────────────────────────┘ │
│                  │                               │
│                  ▼                               │
│  ┌───────────────────────────────────────────┐ │
│  │ 2. Voice Transcription (if voice)         │ │
│  │    Cloudflare Workers AI                  │ │
│  │    Model: whisper-large-v3-turbo          │ │
│  │    Output: Text transcription             │ │
│  └───────────────┬───────────────────────────┘ │
│                  │                               │
│                  ▼                               │
│  ┌───────────────────────────────────────────┐ │
│  │ 3. Message Parsing                        │ │
│  │    Cloudflare Workers AI                  │ │
│  │    Model: qwen3-30b-a3b-fp8               │ │
│  │    Extract:                               │ │
│  │    - Meal time (breakfast/lunch/snack/    │ │
│  │      dinner)                              │ │
│  │    - Food items (array)                   │ │
│  │    - Quantities (with units)              │ │
│  └───────────────┬───────────────────────────┘ │
│                  │                               │
│                  ▼                               │
│  ┌───────────────────────────────────────────┐ │
│  │ 4. Food Matching (For Each Item)         │ │
│  │                                           │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │ 4a. Vectorize Search                │ │ │
│  │  │     Cloudflare Vectorize            │ │ │
│  │  │     Embedding: qwen3-embedding-0.6b │ │ │
│  │  │     Search: R1 + Nutrition table    │ │ │
│  │  │     Threshold: 0.85 similarity      │ │ │
│  │  └──────────┬──────────────────────────┘ │ │
│  │             │                              │ │
│  │             ├─ FOUND → Use nutrition data │ │
│  │             │                              │ │
│  │             └─ NOT FOUND ↓                │ │
│  │                                           │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │ 4b. Nutritionix API Call            │ │ │
│  │  │     GET /v2/search/instant          │ │ │
│  │  │     Extract: calories, protein,     │ │ │
│  │  │              fat, carbs             │ │ │
│  │  └──────────┬──────────────────────────┘ │ │
│  │             │                              │ │
│  │             ▼                              │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │ 4c. Store in Nutrition Table        │ │ │
│  │  │     Google Sheets API               │ │ │
│  │  │     Append new food for future use  │ │ │
│  │  └─────────────────────────────────────┘ │ │
│  └───────────────┬───────────────────────────┘ │
│                  │                               │
│                  ▼                               │
│  ┌───────────────────────────────────────────┐ │
│  │ 5. Calculate Totals                       │ │
│  │    Sum: calories, protein, fat, carbs     │ │
│  │    Adjust for quantities                  │ │
│  └───────────────┬───────────────────────────┘ │
│                  │                               │
│                  ▼                               │
│  ┌───────────────────────────────────────────┐ │
│  │ 6. Update Google Sheets                   │ │
│  │    Service Account OAuth                  │ │
│  │    - Append to Daily Tracker sheet        │ │
│  │    - Handle monthly archiving (if Day 1)  │ │
│  └───────────────┬───────────────────────────┘ │
│                  │                               │
│                  ▼                               │
│  ┌───────────────────────────────────────────┐ │
│  │ 7. Send Confirmation                      │ │
│  │    Telegram sendMessage API               │ │
│  │    Format: "✅ Breakfast logged:          │ │
│  │             520 kcal, 28g protein"        │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│          Google Sheets (3 sheets)            │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ Sheet 1: R1 Reference Table            │ │
│  │ (Master nutrition database)            │ │
│  │ Read-only for worker                   │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ Sheet 2: Nutrition Table               │ │
│  │ (API-learned foods)                    │ │
│  │ Append-only from worker                │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │ Sheet 3: Daily Tracker (YYYY-MM)       │ │
│  │ (User's meal log)                      │ │
│  │ Shared with coach                      │ │
│  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Model/Version |
|-----------|-----------|---------------|
| **Hosting** | Cloudflare Workers | Free tier (100k req/day) |
| **Framework** | Hono.js | Latest |
| **LLM (Parsing)** | Cloudflare Workers AI | qwen3-30b-a3b-fp8 |
| **Embeddings** | Cloudflare Workers AI | qwen3-embedding-0.6b |
| **Voice→Text** | Cloudflare Workers AI | whisper-large-v3-turbo |
| **Vector Search** | Cloudflare Vectorize | 10M vectors free tier |
| **Nutrition API** | Nutritionix API | 500 req/day free |
| **Database** | Google Sheets | Sheets API v4 |
| **Messaging** | Telegram Bot API | Webhook mode |

**Documentation Links:**
- [Qwen3-30B Model](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/)
- [Qwen3-Embedding Model](https://developers.cloudflare.com/workers-ai/models/qwen3-embedding-0.6b/)
- [Whisper Model](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/)

---

## Data Models

### 1. R1 Reference Table (Google Sheet - Master)

**Purpose:** Pre-curated nutrition database for commonly eaten foods  
**Access:** Read-only for worker, manually maintained

**Schema:**

| Column | Type | Example | Description |
|--------|------|---------|-------------|
| A: Food Item | string | Egg | Food name |
| B: Unit of Measurement | string | n, cup, teaspoon, g | Standard unit |
| C: Quantity | float | 1, 0.25, 100 | Standard quantity |
| D: Calories | int | 78 | kcal per quantity |
| E: Protein | float | 6 | grams per quantity |
| F: Fat | float | 5 | grams per quantity |
| G: Carbohydrate | float | 1 | grams per quantity |
| H: Vitamin Profile | string | A, D, B12, Choline | Optional metadata |

**Sample Data:**

```
Egg                                | n         | 1    | 78  | 6     | 5    | 1    | A, D, B12, Choline
Egg White                          | n         | 1    | 17  | 3.6   | 0    | 0    | 
Pea Protein Isolate                | serving   | 1    | 128 | 28    | 1.4  | 1.12 | 
Amul Panneer                       | g         | 100  | 312 | 20    | 24   | 4    |
Milky Mist Low fat panneer         | g         | 100  | 204 | 25    | 9    | 5.7  |
Soya Chunks                        | g         | 50   | 177 | 26.595| 0.41 | 16.75|
Steel cut oats (1 tbsp / 1/4 cup)  | cup       | 0.25 | 38  | 1.3   | 0.7  | 6.5  |
Vegetables (1.5 cup cooked)        | cup       | 1.5  | 100 | 3     | 2    | 17   | Fiber source
Sambar                             | cup       | 1    | 120 | 4     | 4    | 25   |
Paruppu                            | cup       | 1    | 180 | 10    | 4    | 30   | Fiber source
Chutney                            | cup       | 1    | 200 | 4     | 12   | 18   |
Groundnut Oil                      | teaspoon  | 1    | 45  |       | 5    |      |
Ghee                               | teaspoon  | 1    | 45  |       | 5    |      |
Parotta                            | n         |      | 450 | 7     | 22   | 55   |
```

**Notes:**
- Start with 30-50 foods covering 80% of typical meals
- Manually curated for accuracy
- Updated monthly based on Nutrition table learnings

---

### 2. Nutrition Table (Google Sheet - Auto-populated)

**Purpose:** Store foods learned from Nutritionix API  
**Access:** Append-only from worker

**Schema:**

| Column | Type | Example | Description |
|--------|------|---------|-------------|
| A: Food Item | string | Ghee Podi Dosa | Food name from API |
| B: Unit | string | serving, piece | Normalized unit |
| C: Quantity | float | 1 | Standard serving |
| D: Calories | int | 320 | kcal |
| E: Protein | float | 8 | grams |
| F: Fat | float | 12 | grams |
| G: Carbs | float | 45 | grams |
| H: Source | string | nutritionix | API source |
| I: Timestamp | datetime | 2026-02-03 14:30 | When added |

**Behavior:**
- Append row when Vectorize returns no match
- Deduplicate on upsert (check if food exists before adding)
- Periodically review and promote high-confidence items to R1

---

### 3. Daily Tracker Sheet (Google Sheet - User Log)

**Purpose:** User's daily meal log, shared with coach  
**Naming:** `YYYY-MM_Tracker` (e.g., `2026-02_Tracker`)  
**Access:** Append-only from worker, view-only for coach

**Schema:**

| Column | Type | Example | Description |
|--------|------|---------|-------------|
| A: Date | date | 2026-02-02 | Meal date |
| B: Meal Time | string | Breakfast | breakfast/lunch/snack/dinner |
| C: Food Item | string | Chapati | Name from R1 or API |
| D: Quantity | string | 2 | User-specified amount |
| E: Calories (kcal) | int | 240 | Calculated total |
| F: Protein (g) | float | 6 | Calculated total |
| G: Fat (g) | float | 4 | Calculated total |
| H: Carbs (g) | float | 48 | Calculated total |
| I: Water (glasses) | int | 1 | Optional tracking |

**Special Rows:**
- Daily Total: Inserted at end of each day
  - Date: same as meals
  - Meal Time: "TOTAL"
  - Calories/Protein: SUM formulas

**Sample Data:**

```
2026-02-02 | Breakfast | Chapati       | 2        | 240 | 6  | 4  | 48 | 1
2026-02-02 | Breakfast | Protein Shake | 1        | 128 | 28 | 1.4| 1  |
2026-02-02 | Breakfast | Sambar        | 1 cup    | 120 | 4  | 4  | 25 | 1
2026-02-02 | TOTAL     |               |          | 488 | 38 | 9.4| 74 | 2
2026-02-02 | Lunch     | Rice + Dal    | 1 plate  | 600 | 30 | 8  | 95 | 1
```

**Monthly Archiving:**
- On the 1st of each month, create new sheet: `YYYY-MM_Tracker`
- Previous month remains accessible for historical review
- Coach sees all sheets in the workbook

---

## Core User Flows

### Flow 1: Text Entry - Known Food (Happy Path)

**User Input:**
```
"2 chapatis, protein shake, 1 cup sambar for breakfast"
```

**System Process:**
1. Webhook receives message
2. qwen3-30b parses:
   - Meal time: "breakfast"
   - Foods: ["chapati", "protein shake", "sambar"]
   - Quantities: [2, 1, "1 cup"]
3. For each food:
   - Generate embedding (qwen3-embedding-0.6b)
   - Vectorize search against R1
   - Match found (similarity > 0.85)
4. Calculate totals:
   - Chapati: 120 kcal × 2 = 240 kcal, 6g protein
   - Protein shake: 128 kcal × 1 = 128 kcal, 28g protein
   - Sambar: 120 kcal × 1 = 120 kcal, 4g protein
   - **Total: 488 kcal, 38g protein**
5. Append 3 rows to Daily Tracker
6. Reply to user

**Bot Response:**
```
✅ Breakfast logged: 488 kcal, 38g protein
• 2 chapatis: 240 kcal
• 1 protein shake: 128 kcal
• 1 cup sambar: 120 kcal
```

**Time:** <2 seconds

---

### Flow 2: Text Entry - Unknown Food (Auto-resolve)

**User Input:**
```
"ghee podi dosa from Saravana Bhavan for breakfast"
```

**System Process:**
1. Parse: meal time = "breakfast", food = "ghee podi dosa"
2. Vectorize search → No match (similarity < 0.85)
3. Call Nutritionix API:
   ```
   GET https://trackapi.nutritionix.com/v2/search/instant
   ?query=ghee%20podi%20dosa
   Headers: x-app-id, x-app-key
   ```
4. API response:
   ```json
   {
     "branded": [],
     "common": [{
       "food_name": "masala dosa",
       "serving_qty": 1,
       "nf_calories": 320,
       "nf_protein": 8,
       "nf_total_fat": 12,
       "nf_total_carbohydrate": 45
     }]
   }
   ```
5. Store in Nutrition table:
   ```
   Ghee Podi Dosa | serving | 1 | 320 | 8 | 12 | 45 | nutritionix | 2026-02-03 14:30
   ```
6. Append to Daily Tracker
7. Reply to user

**Bot Response:**
```
✅ Breakfast logged: 320 kcal, 8g protein
• 1 ghee podi dosa: 320 kcal (estimated)
```

**Time:** <4 seconds (includes API call)

---

### Flow 3: Voice Entry

**User Input:**
[Voice message: "Had two parottas and chicken curry for lunch"]

**System Process:**
1. Webhook receives voice file
2. Download audio from Telegram
3. Call Cloudflare Whisper:
   ```javascript
   const transcription = await ai.run('@cf/openai/whisper-large-v3-turbo', {
     audio: audioBuffer
   });
   // Output: "had two parottas and chicken curry for lunch"
   ```
4. Continue as text flow (parse → match → log)
5. Parotta found in R1, chicken curry → Nutritionix
6. Log both items
7. Reply to user

**Bot Response:**
```
✅ Lunch logged: 950 kcal, 37g protein
• 2 parottas: 900 kcal
• 1 serving chicken curry: 250 kcal (estimated)
```

**Time:** <5 seconds (voice transcription adds ~1s)

---

### Flow 4: Multiple Entries Same Meal

**User Input (10:00 AM):**
```
"2 eggs for breakfast"
```

**User Input (10:30 AM):**
```
"also had oats and milk for breakfast"
```

**System Process:**
1. First message → Log 2 eggs
2. Second message → Parse "also" as continuation
3. Check last entry timestamp (< 2 hours ago)
4. Same meal time → Append to breakfast
5. Do NOT create duplicate "TOTAL" row

**Bot Response (10:30 AM):**
```
✅ Added to breakfast: 350 kcal, 12g protein
Updated breakfast total: 506 kcal, 18g protein
```

---

## Detailed Component Specifications

### 1. Message Parsing (qwen3-30b)

**Prompt Template:**

```
You are a nutrition tracking assistant. Parse the user's message and extract meal details.

User message: "{user_message}"

Return JSON with:
{
  "meal_time": "breakfast|lunch|snack|dinner",
  "foods": [
    {"name": "chapati", "quantity": 2, "unit": "n"},
    {"name": "sambar", "quantity": 1, "unit": "cup"}
  ]
}

Rules:
- Infer meal time from context (morning = breakfast, afternoon = lunch)
- Default to "snack" if unclear
- Normalize quantities (e.g., "a couple" = 2, "half" = 0.5)
- Extract all food items even if separated by commas
- Handle restaurant names (ignore them, focus on food)

Response (JSON only, no markdown):
```

**Example Outputs:**

Input: "2 chapatis, protein shake, sambar for breakfast"
```json
{
  "meal_time": "breakfast",
  "foods": [
    {"name": "chapati", "quantity": 2, "unit": "n"},
    {"name": "protein shake", "quantity": 1, "unit": "serving"},
    {"name": "sambar", "quantity": 1, "unit": "cup"}
  ]
}
```

Input: "had amul ice cream 100ml"
```json
{
  "meal_time": "snack",
  "foods": [
    {"name": "amul ice cream", "quantity": 100, "unit": "ml"}
  ]
}
```

---

### 2. Vector Search (Cloudflare Vectorize)

**Index Configuration:**

```javascript
// wrangler.toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "nutrition-foods"
dimensions = 512  # qwen3-embedding-0.6b output size
metric = "cosine"
```

**Indexing Process:**

```javascript
// On worker startup or cron job
async function syncVectorize(env) {
  // Fetch R1 and Nutrition tables
  const r1Foods = await fetchGoogleSheet(env.R1_SHEET_ID, 'R1');
  const learnedFoods = await fetchGoogleSheet(env.NUTRITION_SHEET_ID, 'Nutrition');
  
  const allFoods = [...r1Foods, ...learnedFoods];
  
  // Generate embeddings
  const vectors = [];
  for (const food of allFoods) {
    const embedding = await env.AI.run('@cf/qwen/qwen3-embedding-0.6b', {
      text: food.name
    });
    
    vectors.push({
      id: `${food.source}-${food.name}`,
      values: embedding.data[0],
      metadata: {
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        fat: food.fat,
        carbs: food.carbs,
        unit: food.unit,
        quantity: food.quantity,
        source: food.source  // 'r1' or 'nutritionix'
      }
    });
  }
  
  // Upsert to Vectorize
  await env.VECTORIZE.upsert(vectors);
}
```

**Search Process:**

```javascript
async function findFood(foodName, env) {
  // Generate query embedding
  const queryEmbedding = await env.AI.run('@cf/qwen/qwen3-embedding-0.6b', {
    text: foodName
  });
  
  // Search Vectorize
  const results = await env.VECTORIZE.query(queryEmbedding.data[0], {
    topK: 3,
    returnMetadata: true
  });
  
  // Check similarity threshold
  if (results.matches.length > 0 && results.matches[0].score >= 0.85) {
    return results.matches[0].metadata;  // Found match
  }
  
  return null;  // Not found, need API call
}
```

**Fuzzy Matching Examples:**

| User Input | Vectorize Match | Similarity |
|------------|----------------|------------|
| "chappati" | "chapati" | 0.96 |
| "protien shake" | "protein shake" | 0.94 |
| "sambhar" | "sambar" | 0.92 |
| "egg white" | "egg white" | 1.0 |
| "ghee dosa" | (no match) | 0.73 |

---

### 3. Nutritionix API Integration

**API Setup:**

```javascript
// Environment variables
const NUTRITIONIX_APP_ID = env.NUTRITIONIX_APP_ID;
const NUTRITIONIX_API_KEY = env.NUTRITIONIX_API_KEY;
```

**API Call:**

```javascript
async function getNutritionFromAPI(foodName) {
  const response = await fetch(
    `https://trackapi.nutritionix.com/v2/search/instant?query=${encodeURIComponent(foodName)}`,
    {
      headers: {
        'x-app-id': NUTRITIONIX_APP_ID,
        'x-app-key': NUTRITIONIX_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  
  // Prefer common foods over branded
  let item;
  if (data.common && data.common.length > 0) {
    item = data.common[0];
  } else if (data.branded && data.branded.length > 0) {
    item = data.branded[0];
  } else {
    // Fallback: generic estimate
    return {
      name: foodName,
      calories: 200,
      protein: 10,
      fat: 5,
      carbs: 25,
      unit: 'serving',
      quantity: 1,
      estimated: true
    };
  }
  
  return {
    name: item.food_name,
    calories: Math.round(item.nf_calories),
    protein: item.nf_protein || 0,
    fat: item.nf_total_fat || 0,
    carbs: item.nf_total_carbohydrate || 0,
    unit: item.serving_unit || 'serving',
    quantity: item.serving_qty || 1,
    estimated: false
  };
}
```

**Rate Limiting:**
- Nutritionix free tier: 500 requests/day
- Cache API results in Nutrition table
- Vectorize ensures API only called for truly new foods
- Expected usage: 5-10 API calls/day (95% cached)

---

### 4. Google Sheets Integration

**Authentication Setup:**

```javascript
// Service account credentials (stored as Cloudflare secrets)
import { JWT } from 'google-auth-library';
import { google } from 'googleapis';

async function getGoogleSheetsClient(env) {
  const auth = new JWT({
    email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  return google.sheets({ version: 'v4', auth });
}
```

**Permission Setup:**

1. Create Google Cloud Project
2. Enable Google Sheets API
3. Create Service Account → Download JSON key
4. Share sheets with service account email:
   - R1 Sheet: **Viewer** access
   - Nutrition Sheet: **Editor** access
   - Daily Tracker: **Editor** access
   - Coach: **Viewer** access (share manually)

**Read R1 Table:**

```javascript
async function fetchR1Data(sheets, sheetId) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'R1!A2:H',  // Skip header row
  });
  
  return response.data.values.map(row => ({
    name: row[0],
    unit: row[1],
    quantity: parseFloat(row[2]),
    calories: parseInt(row[3]),
    protein: parseFloat(row[4]),
    fat: parseFloat(row[5]),
    carbs: parseFloat(row[6]),
    vitamins: row[7] || '',
    source: 'r1'
  }));
}
```

**Append to Daily Tracker:**

```javascript
async function logMeal(sheets, sheetId, entries) {
  const sheetName = getCurrentMonthSheet();  // e.g., "2026-02_Tracker"
  
  // Ensure sheet exists
  await ensureSheetExists(sheets, sheetId, sheetName);
  
  // Prepare rows
  const rows = entries.map(entry => [
    new Date().toISOString().split('T')[0],  // Date
    entry.mealTime,
    entry.foodName,
    entry.quantity,
    entry.calories,
    entry.protein,
    entry.fat,
    entry.carbs,
    entry.water || ''
  ]);
  
  // Append rows
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A:I`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: rows }
  });
  
  // Add daily total row if last meal of day
  await updateDailyTotal(sheets, sheetId, sheetName);
}
```

**Monthly Sheet Archiving:**

```javascript
async function ensureSheetExists(sheets, sheetId, sheetName) {
  // Check if sheet exists
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const sheetExists = spreadsheet.data.sheets.some(
    sheet => sheet.properties.title === sheetName
  );
  
  if (!sheetExists) {
    // Create new sheet
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: sheetName,
              gridProperties: { frozenRowCount: 1 }
            }
          }
        }]
      }
    });
    
    // Add header row
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${sheetName}!A1:I1`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          'Date', 'Meal Time', 'Food Item', 'Quantity',
          'Calories (kcal)', 'Protein (g)', 'Fat (g)', 'Carbs (g)', 'Water (glasses)'
        ]]
      }
    });
  }
}

function getCurrentMonthSheet() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}_Tracker`;
}
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal:** Core loop working - text input to sheet output

**Tasks:**
1. Set up Cloudflare Worker project
   - Initialize with Wrangler CLI
   - Configure Hono.js framework
   - Set up local development environment

2. Telegram bot integration
   - Create bot via @BotFather
   - Configure webhook to Worker URL
   - Handle incoming text messages

3. Google Sheets authentication
   - Create GCP project
   - Set up service account
   - Store credentials in Cloudflare secrets
   - Test read/write access

4. Basic parsing (qwen3-30b)
   - Implement prompt template
   - Extract meal time and food items
   - Handle 5 test foods

5. Simple sheet append
   - Write to Daily Tracker
   - No vectorize yet (exact string match only)

**Deliverable:** Bot responds to "2 eggs for breakfast" and logs to sheet

**Time:** 20-25 hours

---

### Phase 2: Intelligence (Week 2)

**Goal:** Add vector search, API fallback, voice support

**Tasks:**
1. Cloudflare Vectorize setup
   - Create nutrition-foods index
   - Implement sync script for R1 data
   - Generate embeddings (qwen3-embedding-0.6b)

2. Food matching logic
   - Vectorize search with threshold
   - Fallback to Nutritionix API
   - Store new foods in Nutrition table

3. Nutritionix API integration
   - Sign up for API key
   - Implement search endpoint
   - Parse and normalize responses

4. Voice transcription (Whisper)
   - Handle voice message webhook
   - Download audio file
   - Transcribe and process as text

5. Quantity handling
   - Parse amounts (2, 1 cup, 100g)
   - Multiply base nutrition values
   - Handle unit conversions

**Deliverable:** Bot handles unknown foods and voice messages

**Time:** 25-30 hours

---

### Phase 3: Production Polish (Week 3)

**Goal:** Error handling, UX improvements, coach features

**Tasks:**
1. Error handling
   - API timeouts and retries
   - Malformed user input
   - Sheet quota limits
   - Graceful degradation

2. Confirmation messages
   - Format with calorie/protein breakdown
   - Show estimated vs. confirmed data
   - Add emoji indicators

3. Multi-entry handling
   - Detect continuation messages ("also had...")
   - Aggregate same-meal entries
   - Update daily totals correctly

4. Monthly archiving
   - Auto-create new sheet on month rollover
   - Test date boundary conditions
   - Verify historical data preserved

5. Coach features
   - Share sheet with coach email
   - Add daily goal row (configurable)
   - Conditional formatting for over/under goals

6. Testing
   - Unit tests for parsing logic
   - Integration tests for full flows
   - Load testing (simulate 100 messages/day)

**Deliverable:** Production-ready bot with coach visibility

**Time:** 20-25 hours

---

### Total Estimated Effort: 65-80 hours (3-4 weeks part-time)

---

## Environment Variables

**Cloudflare Secrets (wrangler secret put):**

```bash
# Telegram
TELEGRAM_BOT_TOKEN="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"

# Google Sheets
GOOGLE_SERVICE_ACCOUNT_EMAIL="nutrition-bot@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
R1_SHEET_ID="1abc...xyz"
NUTRITION_SHEET_ID="2def...uvw"
TRACKER_SHEET_ID="3ghi...rst"

# Nutritionix
NUTRITIONIX_APP_ID="abc123..."
NUTRITIONIX_API_KEY="xyz789..."
```

**wrangler.toml:**

```toml
name = "nutrition-tracker-bot"
main = "src/index.js"
compatibility_date = "2024-01-01"

[env.production]
workers_dev = false
route = "https://nutrition-bot.yourdomain.com/*"

[[vectorize]]
binding = "VECTORIZE"
index_name = "nutrition-foods"

[ai]
binding = "AI"
```

---

## Success Metrics

### User Adoption (Primary)
- **Daily Active Users:** 1 user (you) logging 5+ days/week
- **Messages per Day:** 5-10 (1-2 per meal + snacks)
- **Retention:** 80%+ logging rate over 30 days

### System Performance (Secondary)
- **Response Time:** 
  - Text messages: <2 seconds (p95)
  - Voice messages: <5 seconds (p95)
  - Unknown foods: <4 seconds (p95)
- **Accuracy:**
  - Food matching: >90% correct (user doesn't report errors)
  - Quantity parsing: >85% correct
- **API Usage:**
  - Nutritionix calls: <10/day (95% cache hit rate)
  - Vectorize searches: <50/day

### Coach Satisfaction (Tertiary)
- **Visibility:** Coach can view daily logs in real-time
- **Actionability:** Coach identifies patterns without asking user
- **NPS:** Would coach recommend this to other clients? (Target: Yes)

---

## Open Questions & Decisions

### Q1: How to handle multi-item restaurant meals?

**Example:** "Thali at Saravana Bhavan" (contains rice, sambar, veggies, etc.)

**Options:**
1. Ask user to break down components
2. Log as single "thali" item with average nutrition
3. Use LLM to estimate components

**Decision:** Option 2 (MVP), Option 3 (Phase 2)
- Store "thali" as ~800 kcal generic item in Nutrition table
- User can manually correct in sheet if needed

---

### Q2: How to handle quantity normalization?

**Example:** User says "1 bowl" but R1 has "1 cup"

**Decision:** Standardize to cups, implement conversion table
```javascript
const unitConversions = {
  'bowl': { toCup: 1.5 },
  'plate': { toCup: 2.0 },
  'serving': { toCup: 1.0 },
  'tbsp': { toCup: 0.0625 },
  'teaspoon': { toCup: 0.0208 }
};
```

---

### Q3: What if user logs the same meal twice (accidentally)?

**Example:** 
- 10:00 AM: "2 eggs for breakfast"
- 10:05 AM: "2 eggs for breakfast"

**Decision:** Allow duplicates, add daily review command
- Don't auto-deduplicate (user might eat twice)
- Add bot command: `/review today` shows summary
- User can manually delete row in sheet

---

### Q4: How to handle corrections?

**Example:** "Actually that was 3 parottas, not 2"

**Options:**
1. Add edit/delete commands
2. Let user edit sheet directly
3. Append correction as negative entry

**Decision:** Option 2 (MVP)
- Coach can see raw log + manual edits
- Phase 2: Add `/undo` command to delete last entry

---

### Q5: Water tracking - mandatory or optional?

**Decision:** Optional, default to 1 glass per meal
- Helps meet daily hydration goals
- Not enforced if user doesn't mention water

---

## Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Food matching errors** (e.g., matches "chutney" when user meant "paneer") | Medium | Medium | - Use high similarity threshold (0.85)<br>- Show matched food in confirmation<br>- Allow user to report errors via feedback<br>- Weekly manual review of Nutrition table |
| **Google Sheets rate limits** (100 requests/100 seconds) | Low | Medium | - Batch multiple food items in single append<br>- Implement exponential backoff<br>- Queue requests in Durable Objects if needed |
| **Nutritionix API downtime** | Low | High | - Implement retry logic (3 attempts)<br>- Fallback to generic estimates (200 kcal)<br>- Log failures for manual review |
| **Telegram webhook failures** (network issues) | Medium | Low | - Telegram auto-retries failed webhooks<br>- Implement idempotency (check duplicate messages)<br>- Log all webhook payloads for debugging |
| **User abandonment** (too complex, not accurate) | High | High | - Keep UX extremely simple (no commands)<br>- Respond with encouraging messages<br>- Weekly coach check-ins<br>- Quick iteration on reported issues |
| **Coach can't interpret data** | Medium | Medium | - Add daily totals and goal rows<br>- Conditional formatting (red if under protein)<br>- Provide coach with sheet legend |
| **Vectorize cold start** (empty index) | Low | High | - Pre-populate index with R1 on deployment<br>- Test with synthetic data before launch<br>- Monitor index stats in dashboard |
| **R1 maintenance burden** (keeping foods updated) | High | Medium | - Start with 30 foods covering 80% of meals<br>- Review Nutrition table monthly<br>- Promote frequently-used API foods to R1 |
| **Multi-language support** (Tamil food names, Hindi) | Medium | Low | - Phase 2 feature<br>- qwen3 has decent multilingual support<br>- Store alternate names in R1 "aliases" column |

---

## Launch Checklist

### Pre-Launch (Before User Testing)

- [ ] **Infrastructure**
  - [ ] Cloudflare Worker deployed to production
  - [ ] Telegram bot created and webhook configured
  - [ ] Google service account set up with proper permissions
  - [ ] All environment variables configured
  - [ ] Vectorize index created and synced with R1

- [ ] **Data**
  - [ ] R1 sheet populated with 30 foods
  - [ ] Nutrition sheet created (empty)
  - [ ] Daily Tracker sheet created with headers
  - [ ] Coach email added to Tracker with View access

- [ ] **Features**
  - [ ] Text message parsing works (5 test cases)
  - [ ] Voice transcription works (2 test cases)
  - [ ] Food matching via Vectorize (exact match)
  - [ ] Food matching via Vectorize (fuzzy match)
  - [ ] Nutritionix API fallback (unknown food)
  - [ ] New food stored in Nutrition table
  - [ ] Daily Tracker append (multiple entries)
  - [ ] Confirmation message formats correctly
  - [ ] Monthly sheet creation (simulate date rollover)

- [ ] **Error Handling**
  - [ ] Graceful failure if Sheets API down
  - [ ] Graceful failure if Nutritionix down
  - [ ] Handle malformed user input
  - [ ] Handle voice transcription errors
  - [ ] Handle duplicate messages (webhook retry)

- [ ] **Documentation**
  - [ ] User guide: How to log meals
  - [ ] Coach guide: How to interpret sheets
  - [ ] Developer README: How to deploy and maintain

---

### Launch (Day 1)

- [ ] User logs first meal successfully
- [ ] Coach can view entry in sheet
- [ ] Monitor logs for errors (no crashes)

---

### Week 1 Review

- [ ] 5+ meals logged successfully
- [ ] <3 reported errors or confusion
- [ ] Nutritionix API calls <10/day
- [ ] Response time <3s average
- [ ] Coach provides feedback on usefulness

---

### Week 2 Iteration

- [ ] Address top 3 user pain points
- [ ] Add missing foods to R1 (from Nutrition table review)
- [ ] Improve parsing based on failure cases
- [ ] Optimize vector search threshold if needed

---

### Month 1 Success Gate

**Go/No-Go Decision:**
- User logs 80%+ of meals over 30 days → **GO** (continue)
- User logs <50% → **NO-GO** (too much friction, pivot)

**If GO:**
- Plan Phase 2 features (photo logging, goal tracking)
- Onboard 2-3 beta users (other clients)

**If NO-GO:**
- Interview user to understand friction
- Consider simpler fallback (Google Form + Zapier)

---

## Future Enhancements (Phase 2+)

### Short-Term (Next 3 Months)

1. **Photo-based Logging**
   - Use Cloudflare Vision API to detect food
   - Extract items and estimate quantities
   - Confirm with user before logging

2. **Goal Tracking & Alerts**
   - Set daily calorie/protein targets
   - Bot warns if under protein by dinner
   - Weekly summary report to user + coach

3. **Recipe Breakdown**
   - User logs "2 servings of paneer butter masala"
   - Bot asks for recipe components
   - Stores as reusable recipe in R1

4. **Edit/Delete Commands**
   - `/undo` - Delete last logged entry
   - `/edit <meal>` - Modify specific meal
   - `/review today` - Show daily summary

5. **Multi-Language Support**
   - Accept Tamil/Hindi food names
   - Store translations in R1
   - qwen3 already supports multilingual

---

### Long-Term (6-12 Months)

1. **Multi-User Tenancy**
   - Support multiple users (coach has 10 clients)
   - Separate Tracker sheet per user
   - Coach dashboard aggregating all clients

2. **Meal Recommendations**
   - Suggest meals to hit daily protein goal
   - "Try adding 2 eggs for +12g protein"
   - Based on user's R1 preferences

3. **Barcode Scanning**
   - User sends photo of packaged food barcode
   - Look up in Nutritionix branded database
   - Auto-log with exact nutrition data

4. **Integration with Fitness Apps**
   - Sync to MyFitnessPal, Cronometer
   - Export to CSV for analysis
   - API for third-party tools

5. **AI Coach Insights**
   - Weekly analysis by qwen3-30b
   - Identify patterns (always low protein on Saturdays)
   - Suggest habit changes

---

## Cost Analysis

### Monthly Operating Costs (Single User)

| Service | Usage | Free Tier | Paid Cost |
|---------|-------|-----------|-----------|
| **Cloudflare Workers** | ~500 requests/day | 100k req/day | $0 |
| **Cloudflare Workers AI** | ~500 inference calls/day | 10k/day | $0 |
| **Cloudflare Vectorize** | ~500 queries/day | 30M queries/month | $0 |
| **Nutritionix API** | ~10 calls/day (300/mo) | 500/day | $0 |
| **Google Sheets API** | ~500 writes/day | No limit | $0 |
| **Telegram Bot** | Unlimited | Free | $0 |
| **Domain (optional)** | - | - | $12/year |

**Total:** $0-1/month (free tier only)

---

### Scaling Costs (100 Users)

| Service | Usage | Cost |
|---------|-------|------|
| **Cloudflare Workers** | 50k req/day | $0 (still free) |
| **Cloudflare Workers AI** | 50k calls/day | $25/month |
| **Cloudflare Vectorize** | 50k queries/day | $0 (1.5M/mo) |
| **Nutritionix API** | 1k calls/day | $70/month (Pro plan) |
| **Google Sheets API** | 50k writes/day | $0 |

**Total:** ~$95/month for 100 users

---

## Appendix A: Bot Commands

```
/start - Start using the nutrition tracker
/help - Show usage instructions
/today - Show today's meal summary
/week - Show this week's totals
/goal - Set daily nutrition goals
/feedback - Send feedback to developer
```

---

## Appendix B: Google Sheets Formulas

**Daily Total Row (auto-calculated):**

```excel
// In row after last meal entry for the day
=IF(A6=A2, A6, "")  // Date (if same day)
="TOTAL"             // Meal Time
=""                  // Food Item (blank)
=""                  // Quantity (blank)
=SUM(E2:E5)         // Calories
=SUM(F2:F5)         // Protein
=SUM(G2:G5)         // Fat
=SUM(H2:H5)         // Carbs
=SUM(I2:I5)         // Water
```

**Conditional Formatting (for coach):**

```
Rule 1: Protein under goal
Condition: =AND(B6="TOTAL", F6<100)
Format: Light red background

Rule 2: Calories over goal
Condition: =AND(B6="TOTAL", E6>2100)
Format: Light orange background

Rule 3: Protein goal met
Condition: =AND(B6="TOTAL", F6>=100)
Format: Light green background
```

---

## Appendix C: Sample API Responses

### Nutritionix Search Response

```json
{
  "common": [
    {
      "food_name": "masala dosa",
      "serving_unit": "dosa",
      "tag_name": "masala dosa",
      "serving_qty": 1,
      "common_type": null,
      "tag_id": "456",
      "photo": {
        "thumb": "https://d2xdmhkmkbyw75.cloudfront.net/456_thumb.jpg"
      },
      "locale": "en_US"
    }
  ],
  "branded": []
}
```

### Nutritionix Nutrients Response (detailed)

```json
{
  "foods": [
    {
      "food_name": "masala dosa",
      "brand_name": null,
      "serving_qty": 1,
      "serving_unit": "dosa",
      "serving_weight_grams": 120,
      "nf_calories": 320,
      "nf_total_fat": 12,
      "nf_saturated_fat": 2,
      "nf_cholesterol": 0,
      "nf_sodium": 450,
      "nf_total_carbohydrate": 45,
      "nf_dietary_fiber": 3,
      "nf_sugars": 2,
      "nf_protein": 8,
      "nf_potassium": 200
    }
  ]
}
```

---

## Appendix D: Deployment Guide

### Prerequisites

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### Initial Setup

```bash
# Clone repository
git clone https://github.com/yourusername/nutrition-tracker-bot
cd nutrition-tracker-bot

# Install dependencies
npm install

# Configure secrets
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
wrangler secret put GOOGLE_PRIVATE_KEY
wrangler secret put R1_SHEET_ID
wrangler secret put NUTRITION_SHEET_ID
wrangler secret put TRACKER_SHEET_ID
wrangler secret put NUTRITIONIX_APP_ID
wrangler secret put NUTRITIONIX_API_KEY
```

### Deploy

```bash
# Deploy to production
wrangler deploy

# Set Telegram webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-worker.workers.dev/webhook"}'
```

### Sync Vectorize Index

```bash
# Run sync script (one-time or via cron)
wrangler tail  # Monitor logs
curl -X POST "https://your-worker.workers.dev/admin/sync-vectorize" \
  -H "Authorization: Bearer <ADMIN_SECRET>"
```

---

## Appendix E: Troubleshooting

### Bot doesn't respond to messages

**Check:**
1. Webhook is set correctly: `curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
2. Worker is deployed: `wrangler tail` shows incoming requests
3. No errors in logs: Check Cloudflare dashboard

**Fix:**
```bash
# Reset webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-worker.workers.dev/webhook"
```

---

### Food not matching (should be in R1)

**Check:**
1. R1 sheet has correct spelling
2. Vectorize index is synced
3. Similarity threshold too high (0.85)

**Fix:**
```bash
# Re-sync Vectorize
curl -X POST "https://your-worker.workers.dev/admin/sync-vectorize"

# Check index stats
wrangler vectorize list
```

---

### Nutritionix API errors

**Check:**
1. API key is valid
2. Rate limit not exceeded (500/day)
3. Network connectivity

**Fix:**
- Wait 1 hour if rate limited
- Check API dashboard: https://developer.nutritionix.com/

---

### Sheet not updating

**Check:**
1. Service account has Editor access
2. Sheet ID is correct (check URL)
3. Monthly sheet exists

**Fix:**
```bash
# Test sheet access
curl -X GET \
  "https://sheets.googleapis.com/v4/spreadsheets/<SHEET_ID>" \
  -H "Authorization: Bearer <GOOGLE_ACCESS_TOKEN>"
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-03 | Product Team | Initial PRD with full architecture |

---

## Approval & Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | [Your Name] | _________ | ______ |
| Tech Lead | [TBD] | _________ | ______ |
| Coach/User | [Coach Name] | _________ | ______ |

---

**END OF DOCUMENT**
