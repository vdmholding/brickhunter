-- Price monitoring / watch list
CREATE TABLE IF NOT EXISTS monitors (
  id             SERIAL PRIMARY KEY,
  set_number     TEXT NOT NULL,
  condition      TEXT,                         -- 'new', 'used', or null (any)
  target_price   NUMERIC(10,2),                -- alert when total price drops below this
  sources        TEXT[],                       -- e.g. {'ebay','bricklink'}, null = all
  active         BOOLEAN DEFAULT true,
  last_checked   TIMESTAMPTZ,
  last_price     NUMERIC(10,2),
  last_source    TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_monitors_active ON monitors (active) WHERE active = true;
CREATE INDEX idx_monitors_set_number ON monitors (set_number);

-- Alert history
CREATE TABLE IF NOT EXISTS alerts (
  id             SERIAL PRIMARY KEY,
  monitor_id     INT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  price          NUMERIC(10,2) NOT NULL,
  source         TEXT NOT NULL,
  url            TEXT,
  triggered_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_alerts_monitor_id ON alerts (monitor_id);
