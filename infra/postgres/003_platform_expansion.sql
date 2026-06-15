BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reviewer_role_type') THEN
        CREATE TYPE reviewer_role_type AS ENUM ('PASSENGER', 'DRIVER');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_strategy_type') THEN
        CREATE TYPE match_strategy_type AS ENUM ('SEQUENTIAL', 'PARALLEL', 'QUEUE_HYBRID');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_attempt_result_type') THEN
        CREATE TYPE match_attempt_result_type AS ENUM ('PENDING', 'MATCHED', 'TIMED_OUT', 'NO_CANDIDATES', 'FAILED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ride_offer_status_type') THEN
        CREATE TYPE ride_offer_status_type AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'TIMED_OUT', 'CANCELLED', 'FAILED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ride_offer_type_type') THEN
        CREATE TYPE ride_offer_type_type AS ENUM ('DIRECT', 'BATCH', 'QUEUE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_block_type') THEN
        CREATE TYPE match_block_type AS ENUM (
            'PASSENGER_CANCEL_DRIVER_24H',
            'DRIVER_CANCEL_PASSENGER_REDISPATCH',
            'PAIR_RISK_BLOCK',
            'MANUAL_BLOCK'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'saved_place_type') THEN
        CREATE TYPE saved_place_type AS ENUM ('HOME', 'WORK', 'FAVORITE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weather_state_type') THEN
        CREATE TYPE weather_state_type AS ENUM ('CLEAR', 'LIGHT_RAIN', 'MODERATE_RAIN', 'HEAVY_RAIN', 'STORM');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'driver_session_status_type') THEN
        CREATE TYPE driver_session_status_type AS ENUM ('ONLINE', 'BUSY', 'PAUSED', 'OFFLINE', 'RESTRICTED');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_code VARCHAR(40) NOT NULL,
    name VARCHAR(160) NOT NULL,
    operation_code VARCHAR(40) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    polygon geometry(MultiPolygon, 4326) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_service_regions_operation_code UNIQUE (operation_code),
    CONSTRAINT chk_service_regions_priority CHECK (priority >= 0),
    CONSTRAINT chk_service_regions_polygon_valid CHECK (ST_IsValid(polygon)),
    CONSTRAINT chk_service_regions_polygon_srid CHECK (ST_SRID(polygon) = 4326)
);

CREATE INDEX IF NOT EXISTS idx_service_regions_city_code ON service_regions (city_code);
CREATE INDEX IF NOT EXISTS idx_service_regions_priority ON service_regions (priority DESC);
CREATE INDEX IF NOT EXISTS idx_service_regions_is_active ON service_regions (is_active);
CREATE INDEX IF NOT EXISTS idx_service_regions_polygon_gist ON service_regions USING GIST (polygon);

CREATE TABLE IF NOT EXISTS service_region_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_region_id UUID NOT NULL REFERENCES service_regions(id) ON DELETE CASCADE,
    ride_category_id UUID NOT NULL REFERENCES ride_categories(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_service_region_categories UNIQUE (service_region_id, ride_category_id)
);

CREATE INDEX IF NOT EXISTS idx_service_region_categories_region ON service_region_categories (service_region_id);
CREATE INDEX IF NOT EXISTS idx_service_region_categories_category ON service_region_categories (ride_category_id);

CREATE TABLE IF NOT EXISTS category_requirement_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_category_id UUID NOT NULL REFERENCES ride_categories(id) ON DELETE CASCADE,
    min_driver_rating NUMERIC(4,2),
    min_completed_rides INTEGER,
    max_cancellation_rate NUMERIC(5,4),
    min_acceptance_rate NUMERIC(5,4),
    min_vehicle_year SMALLINT,
    min_seat_count SMALLINT,
    requires_pet_ready BOOLEAN NOT NULL DEFAULT FALSE,
    requires_wheelchair_accessible BOOLEAN NOT NULL DEFAULT FALSE,
    requires_corporate_eligibility BOOLEAN NOT NULL DEFAULT FALSE,
    requirements_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_requirement_profiles_category UNIQUE (ride_category_id),
    CONSTRAINT chk_category_requirement_profiles_driver_rating CHECK (min_driver_rating IS NULL OR min_driver_rating BETWEEN 1.00 AND 5.00),
    CONSTRAINT chk_category_requirement_profiles_min_completed_rides CHECK (min_completed_rides IS NULL OR min_completed_rides >= 0),
    CONSTRAINT chk_category_requirement_profiles_max_cancellation CHECK (max_cancellation_rate IS NULL OR max_cancellation_rate BETWEEN 0 AND 1),
    CONSTRAINT chk_category_requirement_profiles_min_acceptance CHECK (min_acceptance_rate IS NULL OR min_acceptance_rate BETWEEN 0 AND 1),
    CONSTRAINT chk_category_requirement_profiles_vehicle_year CHECK (min_vehicle_year IS NULL OR min_vehicle_year BETWEEN 1980 AND 2100),
    CONSTRAINT chk_category_requirement_profiles_seat_count CHECK (min_seat_count IS NULL OR min_seat_count > 0)
);

CREATE TABLE IF NOT EXISTS driver_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    document_number_hash VARCHAR(255),
    issued_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_driver_documents_driver_id ON driver_documents (driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_type_status ON driver_documents (document_type, status);
CREATE INDEX IF NOT EXISTS idx_driver_documents_expires_at ON driver_documents (expires_at);

CREATE TABLE IF NOT EXISTS vehicle_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    document_number_hash VARCHAR(255),
    issued_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_vehicle_documents_vehicle_id ON vehicle_documents (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_type_status ON vehicle_documents (document_type, status);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_expires_at ON vehicle_documents (expires_at);

CREATE TABLE IF NOT EXISTS driver_training_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    certification_code VARCHAR(60) NOT NULL,
    certification_name VARCHAR(160) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_driver_training_certifications UNIQUE (driver_id, certification_code)
);

CREATE INDEX IF NOT EXISTS idx_driver_training_certifications_driver_id ON driver_training_certifications (driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_training_certifications_status ON driver_training_certifications (status);

CREATE TABLE IF NOT EXISTS driver_operational_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    flag_code VARCHAR(60) NOT NULL,
    reason_code VARCHAR(60),
    severity SMALLINT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_driver_operational_flags_severity CHECK (severity BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_driver_operational_flags_driver_id ON driver_operational_flags (driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_operational_flags_active ON driver_operational_flags (is_active);
CREATE INDEX IF NOT EXISTS idx_driver_operational_flags_expires_at ON driver_operational_flags (expires_at);

CREATE TABLE IF NOT EXISTS ride_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
    reviewer_user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    reviewed_user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    reviewer_role reviewer_role_type NOT NULL,
    reviewed_role reviewer_role_type NOT NULL,
    stars SMALLINT NOT NULL,
    comment TEXT,
    sentiment_score NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ride_reviews UNIQUE (ride_id, reviewer_user_id, reviewed_user_id),
    CONSTRAINT chk_ride_reviews_stars CHECK (stars BETWEEN 1 AND 5),
    CONSTRAINT chk_ride_reviews_roles CHECK (reviewer_role <> reviewed_role),
    CONSTRAINT chk_ride_reviews_sentiment CHECK (sentiment_score IS NULL OR sentiment_score BETWEEN -1 AND 1)
);

CREATE INDEX IF NOT EXISTS idx_ride_reviews_reviewed_user ON ride_reviews (reviewed_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ride_reviews_reviewer_user ON ride_reviews (reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_ride_reviews_ride_id ON ride_reviews (ride_id);

CREATE TABLE IF NOT EXISTS review_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    tag_group VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_review_tags_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_review_tags_active ON review_tags (is_active);

CREATE TABLE IF NOT EXISTS ride_review_tag_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_review_id UUID NOT NULL REFERENCES ride_reviews(id) ON DELETE CASCADE,
    review_tag_id UUID NOT NULL REFERENCES review_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ride_review_tag_links UNIQUE (ride_review_id, review_tag_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_review_tag_links_review_id ON ride_review_tag_links (ride_review_id);
CREATE INDEX IF NOT EXISTS idx_ride_review_tag_links_tag_id ON ride_review_tag_links (review_tag_id);

CREATE TABLE IF NOT EXISTS driver_reputation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    weighted_rating NUMERIC(6,4) NOT NULL,
    displayed_rating NUMERIC(4,2) NOT NULL,
    weighted_review_count NUMERIC(12,4) NOT NULL DEFAULT 0,
    direct_rating_component NUMERIC(6,4) NOT NULL DEFAULT 0,
    operational_stability_component NUMERIC(6,4) NOT NULL DEFAULT 0,
    punctuality_component NUMERIC(6,4) NOT NULL DEFAULT 0,
    route_adherence_component NUMERIC(6,4) NOT NULL DEFAULT 0,
    compliance_component NUMERIC(6,4) NOT NULL DEFAULT 0,
    reputation_tier VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_driver_reputation_snapshots UNIQUE (driver_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_driver_reputation_snapshots_driver_date ON driver_reputation_snapshots (driver_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS passenger_reputation_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    weighted_rating NUMERIC(6,4) NOT NULL,
    displayed_rating NUMERIC(4,2) NOT NULL,
    weighted_review_count NUMERIC(12,4) NOT NULL DEFAULT 0,
    direct_rating_component NUMERIC(6,4) NOT NULL DEFAULT 0,
    boarding_presence_component NUMERIC(6,4) NOT NULL DEFAULT 0,
    payment_success_component NUMERIC(6,4) NOT NULL DEFAULT 0,
    late_cancellation_component NUMERIC(6,4) NOT NULL DEFAULT 0,
    conduct_component NUMERIC(6,4) NOT NULL DEFAULT 0,
    reputation_tier VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_passenger_reputation_snapshots UNIQUE (passenger_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_passenger_reputation_snapshots_passenger_date ON passenger_reputation_snapshots (passenger_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS reputation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES viagens(id) ON DELETE SET NULL,
    event_type VARCHAR(60) NOT NULL,
    metric_name VARCHAR(60) NOT NULL,
    metric_value NUMERIC(12,4) NOT NULL,
    weight_value NUMERIC(12,4),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reputation_events_user_id ON reputation_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_events_ride_id ON reputation_events (ride_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_event_type ON reputation_events (event_type);

CREATE TABLE IF NOT EXISTS ride_match_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
    stage_number SMALLINT NOT NULL,
    search_radius_m INTEGER NOT NULL,
    candidate_count INTEGER NOT NULL DEFAULT 0,
    strategy match_strategy_type NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    result_status match_attempt_result_type NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ride_match_attempts_stage UNIQUE (ride_id, stage_number),
    CONSTRAINT chk_ride_match_attempts_stage CHECK (stage_number > 0),
    CONSTRAINT chk_ride_match_attempts_radius CHECK (search_radius_m > 0),
    CONSTRAINT chk_ride_match_attempts_candidates CHECK (candidate_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ride_match_attempts_ride_id ON ride_match_attempts (ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_match_attempts_started_at ON ride_match_attempts (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ride_match_attempts_result_status ON ride_match_attempts (result_status);

CREATE TABLE IF NOT EXISTS ride_match_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES ride_match_attempts(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    score NUMERIC(8,6) NOT NULL,
    eta_pickup_s INTEGER NOT NULL,
    distance_m INTEGER NOT NULL,
    reputation_score NUMERIC(8,6) NOT NULL,
    acceptance_score NUMERIC(8,6) NOT NULL,
    cancellation_score NUMERIC(8,6) NOT NULL,
    online_score NUMERIC(8,6) NOT NULL,
    experience_score NUMERIC(8,6) NOT NULL,
    compatibility_score NUMERIC(8,6) NOT NULL,
    rank_position INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ride_match_candidates UNIQUE (attempt_id, driver_id),
    CONSTRAINT chk_ride_match_candidates_eta CHECK (eta_pickup_s >= 0),
    CONSTRAINT chk_ride_match_candidates_distance CHECK (distance_m >= 0),
    CONSTRAINT chk_ride_match_candidates_rank CHECK (rank_position > 0)
);

CREATE INDEX IF NOT EXISTS idx_ride_match_candidates_attempt_rank ON ride_match_candidates (attempt_id, rank_position);
CREATE INDEX IF NOT EXISTS idx_ride_match_candidates_driver_id ON ride_match_candidates (driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_match_candidates_score ON ride_match_candidates (score DESC);

CREATE TABLE IF NOT EXISTS ride_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL REFERENCES ride_match_attempts(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    offer_batch SMALLINT NOT NULL DEFAULT 1,
    offer_type ride_offer_type_type NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status ride_offer_status_type NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ride_offers_offer_batch CHECK (offer_batch > 0),
    CONSTRAINT chk_ride_offers_expires_after_created CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_ride_offers_driver_status ON ride_offers (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_ride_offers_ride_id ON ride_offers (ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_offers_expires_at ON ride_offers (expires_at);

CREATE TABLE IF NOT EXISTS ride_offer_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_offer_id UUID NOT NULL REFERENCES ride_offers(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    response_status ride_offer_status_type NOT NULL,
    response_code VARCHAR(60),
    responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ride_offer_responses_offer_id ON ride_offer_responses (ride_offer_id);
CREATE INDEX IF NOT EXISTS idx_ride_offer_responses_driver_id ON ride_offer_responses (driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_offer_responses_status ON ride_offer_responses (response_status);

CREATE TABLE IF NOT EXISTS ride_match_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES viagens(id) ON DELETE SET NULL,
    block_type match_block_type NOT NULL,
    reason_code VARCHAR(60),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ride_match_blocks_passenger_driver ON ride_match_blocks (passenger_id, driver_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_ride_match_blocks_driver_passenger ON ride_match_blocks (driver_id, passenger_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_ride_match_blocks_ride_id ON ride_match_blocks (ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_match_blocks_expires_at ON ride_match_blocks (expires_at);

CREATE TABLE IF NOT EXISTS driver_online_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status driver_session_status_type NOT NULL DEFAULT 'ONLINE',
    location_point geometry(Point, 4326),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_online_sessions_driver_id ON driver_online_sessions (driver_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_online_sessions_status ON driver_online_sessions (status);
CREATE INDEX IF NOT EXISTS idx_driver_online_sessions_heartbeat ON driver_online_sessions (last_heartbeat_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_online_sessions_location_gist ON driver_online_sessions USING GIST (location_point);

CREATE TABLE IF NOT EXISTS driver_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    session_id UUID REFERENCES driver_online_sessions(id) ON DELETE SET NULL,
    ride_id UUID REFERENCES viagens(id) ON DELETE SET NULL,
    location_point geometry(Point, 4326) NOT NULL,
    heading SMALLINT,
    speed_kmh NUMERIC(6,2),
    accuracy_m NUMERIC(8,2),
    source VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_driver_location_history_heading CHECK (heading IS NULL OR heading BETWEEN 0 AND 360),
    CONSTRAINT chk_driver_location_history_speed CHECK (speed_kmh IS NULL OR speed_kmh >= 0),
    CONSTRAINT chk_driver_location_history_accuracy CHECK (accuracy_m IS NULL OR accuracy_m >= 0)
);

CREATE INDEX IF NOT EXISTS idx_driver_location_history_driver_time ON driver_location_history (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_location_history_session_id ON driver_location_history (session_id);
CREATE INDEX IF NOT EXISTS idx_driver_location_history_ride_id ON driver_location_history (ride_id);
CREATE INDEX IF NOT EXISTS idx_driver_location_history_point_gist ON driver_location_history USING GIST (location_point);

CREATE TABLE IF NOT EXISTS pricing_rule_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pricing_rule_sets_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_pricing_rule_sets_active ON pricing_rule_sets (is_active);

CREATE TABLE IF NOT EXISTS pricing_rule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_set_id UUID NOT NULL REFERENCES pricing_rule_sets(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES ride_categories(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES pricing_regions(id) ON DELETE CASCADE,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    base_fare_centavos BIGINT NOT NULL,
    distance_rate_centavos_km BIGINT NOT NULL,
    time_rate_centavos_min BIGINT NOT NULL,
    minimum_fare_centavos BIGINT NOT NULL,
    booking_fee_centavos BIGINT NOT NULL DEFAULT 0,
    traffic_coefficient NUMERIC(8,4) NOT NULL DEFAULT 0,
    take_rate_bps INTEGER NOT NULL,
    driver_dynamic_share_bps INTEGER NOT NULL,
    config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_pricing_rule_versions_base_fare CHECK (base_fare_centavos >= 0),
    CONSTRAINT chk_pricing_rule_versions_distance_rate CHECK (distance_rate_centavos_km >= 0),
    CONSTRAINT chk_pricing_rule_versions_time_rate CHECK (time_rate_centavos_min >= 0),
    CONSTRAINT chk_pricing_rule_versions_minimum_fare CHECK (minimum_fare_centavos >= 0),
    CONSTRAINT chk_pricing_rule_versions_booking_fee CHECK (booking_fee_centavos >= 0),
    CONSTRAINT chk_pricing_rule_versions_take_rate CHECK (take_rate_bps BETWEEN 0 AND 10000),
    CONSTRAINT chk_pricing_rule_versions_driver_dynamic_share CHECK (driver_dynamic_share_bps BETWEEN 0 AND 10000),
    CONSTRAINT chk_pricing_rule_versions_effective_window CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS idx_pricing_rule_versions_category_region_from
    ON pricing_rule_versions (category_id, region_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_rule_versions_effective_to
    ON pricing_rule_versions (effective_to);

CREATE TABLE IF NOT EXISTS pricing_region_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pricing_region_id UUID NOT NULL REFERENCES pricing_regions(id) ON DELETE CASCADE,
    ride_category_id UUID NOT NULL REFERENCES ride_categories(id) ON DELETE CASCADE,
    pricing_rule_version_id UUID NOT NULL REFERENCES pricing_rule_versions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pricing_region_assignments UNIQUE (pricing_region_id, ride_category_id, pricing_rule_version_id)
);

CREATE INDEX IF NOT EXISTS idx_pricing_region_assignments_region ON pricing_region_assignments (pricing_region_id);
CREATE INDEX IF NOT EXISTS idx_pricing_region_assignments_category ON pricing_region_assignments (ride_category_id);

CREATE TABLE IF NOT EXISTS dynamic_pricing_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES pricing_regions(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES ride_categories(id) ON DELETE CASCADE,
    snapshot_at TIMESTAMPTZ NOT NULL,
    demand_pressure NUMERIC(8,4) NOT NULL DEFAULT 0,
    weather_pressure NUMERIC(8,4) NOT NULL DEFAULT 0,
    event_pressure NUMERIC(8,4) NOT NULL DEFAULT 0,
    airport_pressure NUMERIC(8,4) NOT NULL DEFAULT 0,
    traffic_pressure NUMERIC(8,4) NOT NULL DEFAULT 0,
    supply_shortage NUMERIC(8,4) NOT NULL DEFAULT 0,
    time_pressure NUMERIC(8,4) NOT NULL DEFAULT 0,
    conversion_pressure NUMERIC(8,4) NOT NULL DEFAULT 0,
    multiplier_raw NUMERIC(8,4) NOT NULL,
    multiplier_effective NUMERIC(8,4) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_dynamic_pricing_snapshots UNIQUE (region_id, category_id, snapshot_at),
    CONSTRAINT chk_dynamic_pricing_snapshots_version CHECK (version > 0)
);

CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_snapshots_region_category
    ON dynamic_pricing_snapshots (region_id, category_id, snapshot_at DESC);

CREATE TABLE IF NOT EXISTS event_surge_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID REFERENCES pricing_regions(id) ON DELETE SET NULL,
    category_id UUID REFERENCES ride_categories(id) ON DELETE SET NULL,
    event_name VARCHAR(160) NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    pressure_factor NUMERIC(8,4) NOT NULL,
    source VARCHAR(60),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_event_surge_inputs_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_event_surge_inputs_region_time ON event_surge_inputs (region_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_event_surge_inputs_category_time ON event_surge_inputs (category_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS weather_region_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES pricing_regions(id) ON DELETE CASCADE,
    weather_state weather_state_type NOT NULL,
    intensity_index NUMERIC(8,4) NOT NULL DEFAULT 0,
    confidence NUMERIC(8,4) NOT NULL DEFAULT 0,
    observed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_weather_region_snapshots_intensity CHECK (intensity_index >= 0),
    CONSTRAINT chk_weather_region_snapshots_confidence CHECK (confidence BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS idx_weather_region_snapshots_region_time ON weather_region_snapshots (region_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS airport_operational_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID REFERENCES pricing_regions(id) ON DELETE SET NULL,
    airport_code VARCHAR(20) NOT NULL,
    terminal_code VARCHAR(20),
    ride_category_id UUID REFERENCES ride_categories(id) ON DELETE SET NULL,
    pickup_fee_centavos BIGINT NOT NULL DEFAULT 0,
    dropoff_fee_centavos BIGINT NOT NULL DEFAULT 0,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_airport_operational_fees_pickup CHECK (pickup_fee_centavos >= 0),
    CONSTRAINT chk_airport_operational_fees_dropoff CHECK (dropoff_fee_centavos >= 0),
    CONSTRAINT chk_airport_operational_fees_window CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS idx_airport_operational_fees_airport_terminal
    ON airport_operational_fees (airport_code, terminal_code, effective_from DESC);

CREATE TABLE IF NOT EXISTS route_toll_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    road_name VARCHAR(120) NOT NULL,
    plaza_name VARCHAR(120) NOT NULL,
    location_point geometry(Point, 4326) NOT NULL,
    direction VARCHAR(40),
    fee_centavos BIGINT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_route_toll_catalog_fee CHECK (fee_centavos >= 0)
);

CREATE INDEX IF NOT EXISTS idx_route_toll_catalog_active ON route_toll_catalog (is_active);
CREATE INDEX IF NOT EXISTS idx_route_toll_catalog_point_gist ON route_toll_catalog USING GIST (location_point);

CREATE TABLE IF NOT EXISTS place_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapbox_feature_id VARCHAR(120) NOT NULL,
    place_name TEXT NOT NULL,
    address_text TEXT,
    point geometry(Point, 4326) NOT NULL,
    context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    accuracy VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_place_cache_feature_id UNIQUE (mapbox_feature_id)
);

CREATE INDEX IF NOT EXISTS idx_place_cache_point_gist ON place_cache USING GIST (point);

CREATE TABLE IF NOT EXISTS user_saved_places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    place_type saved_place_type NOT NULL,
    label VARCHAR(120) NOT NULL,
    mapbox_feature_id VARCHAR(120),
    address_text TEXT NOT NULL,
    point geometry(Point, 4326) NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_saved_places_home_active
    ON user_saved_places (user_id, place_type)
    WHERE place_type = 'HOME' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_saved_places_work_active
    ON user_saved_places (user_id, place_type)
    WHERE place_type = 'WORK' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_saved_places_user_id ON user_saved_places (user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_places_place_type ON user_saved_places (place_type);
CREATE INDEX IF NOT EXISTS idx_user_saved_places_point_gist ON user_saved_places USING GIST (point);

CREATE TABLE IF NOT EXISTS user_place_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    mapbox_feature_id VARCHAR(120),
    address_text TEXT NOT NULL,
    point geometry(Point, 4326) NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usage_count INTEGER NOT NULL DEFAULT 1,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_place_history_usage_count CHECK (usage_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_user_place_history_user_last_used ON user_place_history (user_id, last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_place_history_point_gist ON user_place_history USING GIST (point);

CREATE TABLE IF NOT EXISTS place_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    place_cache_id UUID NOT NULL REFERENCES place_cache(id) ON DELETE CASCADE,
    alias VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_place_aliases UNIQUE (user_id, place_cache_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_place_aliases_user_id ON place_aliases (user_id);
CREATE INDEX IF NOT EXISTS idx_place_aliases_place_cache_id ON place_aliases (place_cache_id);

CREATE TABLE IF NOT EXISTS place_popularity_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_code VARCHAR(40) NOT NULL,
    geohash VARCHAR(24) NOT NULL,
    pickup_count BIGINT NOT NULL DEFAULT 0,
    dropoff_count BIGINT NOT NULL DEFAULT 0,
    search_count BIGINT NOT NULL DEFAULT 0,
    last_aggregated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_place_popularity_stats UNIQUE (city_code, geohash),
    CONSTRAINT chk_place_popularity_stats_pickup_count CHECK (pickup_count >= 0),
    CONSTRAINT chk_place_popularity_stats_dropoff_count CHECK (dropoff_count >= 0),
    CONSTRAINT chk_place_popularity_stats_search_count CHECK (search_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_place_popularity_stats_city_code ON place_popularity_stats (city_code);

COMMIT;
