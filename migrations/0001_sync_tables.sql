-- Mirror of Nutrition sheet for SYNC (Sheets ↔ D1). Source of truth for sync is Sheets; admin sync pushes Sheets → D1.
CREATE TABLE IF NOT EXISTS nutrition_sync (
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  calories INTEGER NOT NULL DEFAULT 0,
  protein REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  source TEXT,
  synced_at TEXT,
  PRIMARY KEY (name, unit)
);

-- Mirror of Tracker sheet(s) for SYNC. Rows keyed by date + meal + food for idempotent sync.
CREATE TABLE IF NOT EXISTS tracker_sync (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  meal_time TEXT NOT NULL,
  food_item TEXT NOT NULL,
  quantity TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  protein REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  water TEXT,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tracker_sync_date ON tracker_sync(date);
