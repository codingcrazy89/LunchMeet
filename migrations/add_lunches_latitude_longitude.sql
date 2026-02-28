-- Add latitude/longitude to lunches so the map view works in standalone builds
-- (no proxy needed for coordinates when host creates a lunch)
ALTER TABLE lunches ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE lunches ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
