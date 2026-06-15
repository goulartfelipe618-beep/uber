BEGIN;

CREATE TABLE IF NOT EXISTS ride_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    passenger_limit_min SMALLINT NOT NULL DEFAULT 1,
    passenger_limit_max SMALLINT NOT NULL,
    bag_policy_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_shared BOOLEAN NOT NULL DEFAULT FALSE,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_ride_categories_code UNIQUE (code),
    CONSTRAINT chk_ride_categories_passenger_limit_min CHECK (passenger_limit_min >= 0),
    CONSTRAINT chk_ride_categories_passenger_limit_max CHECK (passenger_limit_max >= passenger_limit_min)
);

CREATE INDEX IF NOT EXISTS idx_ride_categories_is_active
    ON ride_categories (is_active);

CREATE INDEX IF NOT EXISTS idx_ride_categories_deleted_at
    ON ride_categories (deleted_at);

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    plate VARCHAR(16) NOT NULL,
    renavam_hash VARCHAR(255),
    make VARCHAR(80) NOT NULL,
    model VARCHAR(80) NOT NULL,
    year SMALLINT NOT NULL,
    color VARCHAR(40),
    body_type VARCHAR(40),
    seat_count SMALLINT NOT NULL,
    trunk_capacity_l INTEGER,
    wheelchair_accessible BOOLEAN NOT NULL DEFAULT FALSE,
    pet_ready BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_vehicles_year CHECK (year BETWEEN 1980 AND 2100),
    CONSTRAINT chk_vehicles_seat_count CHECK (seat_count > 0),
    CONSTRAINT chk_vehicles_trunk_capacity_l CHECK (trunk_capacity_l IS NULL OR trunk_capacity_l >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_plate_active
    ON vehicles (plate)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id
    ON vehicles (driver_id);

CREATE INDEX IF NOT EXISTS idx_vehicles_status
    ON vehicles (status);

CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at
    ON vehicles (deleted_at);

CREATE TABLE IF NOT EXISTS vehicle_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    ride_category_id UUID NOT NULL REFERENCES ride_categories(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vehicle_categories_vehicle_category UNIQUE (vehicle_id, ride_category_id)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_categories_vehicle_id
    ON vehicle_categories (vehicle_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_categories_ride_category_id
    ON vehicle_categories (ride_category_id);

CREATE TABLE IF NOT EXISTS driver_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ride_category_id UUID NOT NULL REFERENCES ride_categories(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_driver_categories_driver_category UNIQUE (driver_id, ride_category_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_categories_driver_id
    ON driver_categories (driver_id);

CREATE INDEX IF NOT EXISTS idx_driver_categories_ride_category_id
    ON driver_categories (ride_category_id);

CREATE TABLE IF NOT EXISTS driver_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    completed_rides_count BIGINT NOT NULL DEFAULT 0,
    cancelled_rides_count BIGINT NOT NULL DEFAULT 0,
    accepted_rides_count BIGINT NOT NULL DEFAULT 0,
    rejected_rides_count BIGINT NOT NULL DEFAULT 0,
    total_distance_m BIGINT NOT NULL DEFAULT 0,
    total_time_s BIGINT NOT NULL DEFAULT 0,
    rating_avg NUMERIC(4,2),
    rating_count BIGINT NOT NULL DEFAULT 0,
    acceptance_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
    cancellation_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
    online_time_s BIGINT NOT NULL DEFAULT 0,
    last_ride_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_driver_statistics_driver_id UNIQUE (driver_id),
    CONSTRAINT chk_driver_statistics_completed_rides CHECK (completed_rides_count >= 0),
    CONSTRAINT chk_driver_statistics_cancelled_rides CHECK (cancelled_rides_count >= 0),
    CONSTRAINT chk_driver_statistics_accepted_rides CHECK (accepted_rides_count >= 0),
    CONSTRAINT chk_driver_statistics_rejected_rides CHECK (rejected_rides_count >= 0),
    CONSTRAINT chk_driver_statistics_total_distance CHECK (total_distance_m >= 0),
    CONSTRAINT chk_driver_statistics_total_time CHECK (total_time_s >= 0),
    CONSTRAINT chk_driver_statistics_rating_count CHECK (rating_count >= 0),
    CONSTRAINT chk_driver_statistics_online_time CHECK (online_time_s >= 0),
    CONSTRAINT chk_driver_statistics_rating_avg CHECK (rating_avg IS NULL OR rating_avg BETWEEN 1.00 AND 5.00),
    CONSTRAINT chk_driver_statistics_acceptance_rate CHECK (acceptance_rate BETWEEN 0 AND 1),
    CONSTRAINT chk_driver_statistics_cancellation_rate CHECK (cancellation_rate BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS idx_driver_statistics_last_ride_at
    ON driver_statistics (last_ride_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_statistics_updated_at
    ON driver_statistics (updated_at DESC);

CREATE TABLE IF NOT EXISTS pricing_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_code VARCHAR(40),
    name VARCHAR(160) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    polygon geometry(MultiPolygon, 4326) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_pricing_regions_priority CHECK (priority >= 0),
    CONSTRAINT chk_pricing_regions_polygon_valid CHECK (ST_IsValid(polygon)),
    CONSTRAINT chk_pricing_regions_polygon_srid CHECK (ST_SRID(polygon) = 4326),
    CONSTRAINT chk_pricing_regions_polygon_type CHECK (GeometryType(polygon) = 'MULTIPOLYGON'::text)
);

CREATE INDEX IF NOT EXISTS idx_pricing_regions_city_code
    ON pricing_regions (city_code);

CREATE INDEX IF NOT EXISTS idx_pricing_regions_priority
    ON pricing_regions (priority DESC);

CREATE INDEX IF NOT EXISTS idx_pricing_regions_is_active
    ON pricing_regions (is_active);

CREATE INDEX IF NOT EXISTS idx_pricing_regions_deleted_at
    ON pricing_regions (deleted_at);

CREATE INDEX IF NOT EXISTS idx_pricing_regions_polygon_gist
    ON pricing_regions USING GIST (polygon);

COMMIT;
