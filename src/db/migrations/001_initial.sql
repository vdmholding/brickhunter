-- Lego sets catalogue
CREATE TABLE IF NOT EXISTS sets (
  id            SERIAL PRIMARY KEY,
  set_number    TEXT UNIQUE NOT NULL,        -- e.g. "75192" or "75192-1"
  name          TEXT NOT NULL,
  theme         TEXT,                        -- e.g. "Star Wars", "Technic"
  year          SMALLINT,
  piece_count   INT,
  retail_price  NUMERIC(10,2),               -- original MSRP
  image_url     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sets_set_number ON sets (set_number);
CREATE INDEX idx_sets_theme ON sets (theme);

-- Price listings found across sources
CREATE TABLE IF NOT EXISTS listings (
  id            SERIAL PRIMARY KEY,
  set_id        INT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
  source        TEXT NOT NULL,               -- 'ebay', 'bricklink', 'lego', 'brickeconomy'
  condition     TEXT,                        -- 'new', 'used', 'sealed'
  price         NUMERIC(10,2) NOT NULL,
  currency      TEXT DEFAULT 'USD',
  shipping      NUMERIC(10,2),
  seller        TEXT,
  url           TEXT,
  found_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_listings_set_id ON listings (set_id);
CREATE INDEX idx_listings_source ON listings (source);
CREATE INDEX idx_listings_found_at ON listings (found_at);

-- Search history / user queries
CREATE TABLE IF NOT EXISTS searches (
  id            SERIAL PRIMARY KEY,
  query         TEXT NOT NULL,               -- raw user query, e.g. "UCS Millennium Falcon"
  set_number    TEXT,                        -- resolved set number if identified
  results_count INT,
  best_price    NUMERIC(10,2),
  best_source   TEXT,
  searched_at   TIMESTAMPTZ DEFAULT now()
);
