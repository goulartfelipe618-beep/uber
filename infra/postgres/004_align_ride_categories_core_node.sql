BEGIN;

ALTER TABLE ride_categories
    ADD COLUMN IF NOT EXISTS base_fare NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE ride_categories
    ADD COLUMN IF NOT EXISTS price_per_km NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE ride_categories
    ADD COLUMN IF NOT EXISTS price_per_minute NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE ride_categories
    ADD COLUMN IF NOT EXISTS minimum_fare NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE ride_categories
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_ride_categories_active
    ON ride_categories (active);

COMMIT;
