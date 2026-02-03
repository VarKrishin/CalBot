-- Reference foods (R1) stored in Cloudflare D1. Same concept as before, now in D1 instead of a Google Sheet.
CREATE TABLE IF NOT EXISTS r1_foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  calories INTEGER NOT NULL DEFAULT 0,
  protein REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  vitamins TEXT
);

CREATE INDEX IF NOT EXISTS idx_r1_foods_name ON r1_foods(name);
