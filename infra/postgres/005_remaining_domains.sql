BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ride_status_type') THEN
        CREATE TYPE ride_status_type AS ENUM (
            'REQUESTED',
            'DRIVER_ASSIGNED',
            'DRIVER_ARRIVED',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'route_strategy_type') THEN
        CREATE TYPE route_strategy_type AS ENUM ('FASTEST', 'SHORTEST', 'ECONOMIC', 'LOW_TRAFFIC');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_type') THEN
        CREATE TYPE payment_method_type AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_intent_status_type') THEN
        CREATE TYPE payment_intent_status_type AS ENUM (
            'PENDING',
            'AUTHORIZED',
            'CAPTURED',
            'FAILED',
            'CANCELLED',
            'REFUNDED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_transaction_type') THEN
        CREATE TYPE payment_transaction_type AS ENUM (
            'AUTHORIZATION',
            'CAPTURE',
            'REFUND',
            'CHARGEBACK',
            'PIX_CHARGE'
        );
    END IF;
END $$;

ALTER TABLE ride_categories
    ADD COLUMN IF NOT EXISTS pricing_multipliers_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ride_categories
    ADD COLUMN IF NOT EXISTS dynamic_cap NUMERIC(6,2) NOT NULL DEFAULT 2.20;

ALTER TABLE viagens
    ADD COLUMN IF NOT EXISTS ride_category_id UUID REFERENCES ride_categories(id) ON DELETE SET NULL;

ALTER TABLE viagens
    ADD COLUMN IF NOT EXISTS ride_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE viagens
    ADD COLUMN IF NOT EXISTS payment_method payment_method_type;

ALTER TABLE viagens
    ADD COLUMN IF NOT EXISTS dynamic_multiplier NUMERIC(8,4) NOT NULL DEFAULT 1.0000;

ALTER TABLE viagens
    ADD COLUMN IF NOT EXISTS pricing_rule_version_id UUID REFERENCES pricing_rule_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_viagens_ride_category_id ON viagens (ride_category_id);

CREATE TABLE IF NOT EXISTS ride_start_code_pairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
    passenger_code_hash VARCHAR(128) NOT NULL,
    driver_code_hash VARCHAR(128) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    passenger_validated_at TIMESTAMPTZ,
    driver_validated_at TIMESTAMPTZ,
    reissue_count SMALLINT NOT NULL DEFAULT 0,
    passenger_attempts SMALLINT NOT NULL DEFAULT 0,
    driver_attempts SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ride_start_code_pairs_reissue CHECK (reissue_count BETWEEN 0 AND 3),
    CONSTRAINT chk_ride_start_code_pairs_attempts CHECK (passenger_attempts >= 0 AND driver_attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ride_start_code_pairs_ride_active
    ON ride_start_code_pairs (ride_id, is_active);

CREATE TABLE IF NOT EXISTS ride_start_code_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
    code_pair_id UUID REFERENCES ride_start_code_pairs(id) ON DELETE SET NULL,
    role reviewer_role_type NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address INET,
    device_id VARCHAR(120),
    location_point geometry(Point, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ride_start_code_attempts_ride_id ON ride_start_code_attempts (ride_id, created_at DESC);

CREATE TABLE IF NOT EXISTS route_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES viagens(id) ON DELETE SET NULL,
    user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    origin_point geometry(Point, 4326) NOT NULL,
    destination_point geometry(Point, 4326) NOT NULL,
    strategy route_strategy_type NOT NULL DEFAULT 'FASTEST',
    distance_m INTEGER,
    eta_seconds INTEGER,
    tolls_total_centavos BIGINT NOT NULL DEFAULT 0,
    traffic_level_index NUMERIC(8,4),
    incident_count INTEGER NOT NULL DEFAULT 0,
    route_polyline TEXT,
    deviation_risk_score NUMERIC(8,4),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_requests_ride_id ON route_requests (ride_id);
CREATE INDEX IF NOT EXISTS idx_route_requests_user_id ON route_requests (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS route_alternatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_request_id UUID NOT NULL REFERENCES route_requests(id) ON DELETE CASCADE,
    strategy route_strategy_type NOT NULL,
    distance_m INTEGER NOT NULL,
    eta_seconds INTEGER NOT NULL,
    tolls_total_centavos BIGINT NOT NULL DEFAULT 0,
    traffic_level_index NUMERIC(8,4),
    incident_count INTEGER NOT NULL DEFAULT 0,
    route_polyline TEXT,
    generalized_cost NUMERIC(12,4),
    is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_alternatives_request_id ON route_alternatives (route_request_id);

CREATE TABLE IF NOT EXISTS active_route_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
    route_alternative_id UUID REFERENCES route_alternatives(id) ON DELETE SET NULL,
    current_polyline TEXT,
    current_eta_seconds INTEGER,
    current_distance_m INTEGER,
    last_recalc_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_active_route_states_ride UNIQUE (ride_id)
);

CREATE TABLE IF NOT EXISTS route_recalculation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
    active_route_state_id UUID REFERENCES active_route_states(id) ON DELETE SET NULL,
    reason_code VARCHAR(60) NOT NULL,
    eta_delta_seconds INTEGER,
    previous_eta_seconds INTEGER,
    new_eta_seconds INTEGER,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_route_recalculation_events_ride_id ON route_recalculation_events (ride_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    method_type payment_method_type NOT NULL,
    provider VARCHAR(60),
    provider_token_ref VARCHAR(255),
    last_four VARCHAR(4),
    brand VARCHAR(40),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods (is_active);

CREATE TABLE IF NOT EXISTS payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    payment_method_type payment_method_type NOT NULL,
    status payment_intent_status_type NOT NULL DEFAULT 'PENDING',
    amount_authorized_centavos BIGINT NOT NULL DEFAULT 0,
    amount_captured_centavos BIGINT NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'BRL',
    provider VARCHAR(60),
    provider_ref VARCHAR(255),
    idempotency_key VARCHAR(120),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_payment_intents_amounts CHECK (
        amount_authorized_centavos >= 0 AND amount_captured_centavos >= 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_intents_active_ride
    ON payment_intents (ride_id)
    WHERE status IN ('PENDING', 'AUTHORIZED');

CREATE INDEX IF NOT EXISTS idx_payment_intents_user_id ON payment_intents (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON payment_intents (status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_ref ON payment_intents (provider_ref);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
    transaction_type payment_transaction_type NOT NULL,
    amount_centavos BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'BRL',
    provider VARCHAR(60),
    provider_ref VARCHAR(255),
    status VARCHAR(30) NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_payment_transactions_amount CHECK (amount_centavos >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_intent_id ON payment_transactions (payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_ref ON payment_transactions (provider_ref);

CREATE TABLE IF NOT EXISTS pix_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
    qr_code_payload TEXT,
    copy_paste_code TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    provider_ref VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pix_charges_intent_id ON pix_charges (payment_intent_id);

CREATE TABLE IF NOT EXISTS cash_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
    ride_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
    amount_centavos BIGINT NOT NULL,
    confirmed_by_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    confirmed_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cash_settlements_amount CHECK (amount_centavos >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cash_settlements_ride_id ON cash_settlements (ride_id);

CREATE TABLE IF NOT EXISTS driver_payout_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    gross_centavos BIGINT NOT NULL,
    platform_fee_centavos BIGINT NOT NULL DEFAULT 0,
    net_centavos BIGINT NOT NULL,
    dynamic_share_centavos BIGINT NOT NULL DEFAULT 0,
    toll_repass_centavos BIGINT NOT NULL DEFAULT 0,
    incentive_centavos BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    settled_at TIMESTAMPTZ,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_payout_ledger_driver_id ON driver_payout_ledger (driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_payout_ledger_ride_id ON driver_payout_ledger (ride_id);

CREATE TABLE IF NOT EXISTS platform_fee_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES viagens(id) ON DELETE CASCADE,
    take_rate_bps INTEGER NOT NULL,
    fee_centavos BIGINT NOT NULL,
    dynamic_retained_centavos BIGINT NOT NULL DEFAULT 0,
    booking_fee_centavos BIGINT NOT NULL DEFAULT 0,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_platform_fee_ledger_take_rate CHECK (take_rate_bps BETWEEN 0 AND 10000)
);

CREATE INDEX IF NOT EXISTS idx_platform_fee_ledger_ride_id ON platform_fee_ledger (ride_id);

CREATE TABLE IF NOT EXISTS fraud_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    ride_id UUID REFERENCES viagens(id) ON DELETE SET NULL,
    signal_type VARCHAR(60) NOT NULL,
    score NUMERIC(8,4) NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_signals_user_id ON fraud_signals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_type ON fraud_signals (signal_type);

CREATE TABLE IF NOT EXISTS fraud_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    risk_score NUMERIC(8,4) NOT NULL,
    summary TEXT,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_status ON fraud_cases (status);

CREATE TABLE IF NOT EXISTS device_fingerprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fingerprint_hash VARCHAR(255) NOT NULL,
    platform VARCHAR(40),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user_id ON device_fingerprints (user_id);
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_hash ON device_fingerprints (fingerprint_hash);

CREATE TABLE IF NOT EXISTS account_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_a UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    user_id_b UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    link_type VARCHAR(60) NOT NULL,
    similarity_score NUMERIC(8,4) NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_account_links_distinct CHECK (user_id_a <> user_id_b)
);

CREATE INDEX IF NOT EXISTS idx_account_links_users ON account_links (user_id_a, user_id_b);

CREATE TABLE IF NOT EXISTS gps_integrity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES viagens(id) ON DELETE SET NULL,
    event_type VARCHAR(60) NOT NULL,
    confidence_score NUMERIC(8,4) NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_integrity_events_driver_id ON gps_integrity_events (driver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS coupon_redemption_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES viagens(id) ON DELETE SET NULL,
    coupon_code VARCHAR(60) NOT NULL,
    discount_centavos BIGINT NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemption_audit_user_id ON coupon_redemption_audit (user_id);

CREATE TABLE IF NOT EXISTS risk_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    ride_id UUID REFERENCES viagens(id) ON DELETE SET NULL,
    decision_type VARCHAR(60) NOT NULL,
    risk_score NUMERIC(8,4) NOT NULL,
    action_taken VARCHAR(120),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_decisions_user_id ON risk_decisions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS event_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type VARCHAR(80) NOT NULL,
    aggregate_type VARCHAR(60) NOT NULL,
    aggregate_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    producer VARCHAR(60) NOT NULL,
    schema_version SMALLINT NOT NULL DEFAULT 1,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    trace_id VARCHAR(120),
    idempotency_key VARCHAR(120),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_event_outbox_event_id UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_outbox_unpublished ON event_outbox (created_at) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_event_outbox_aggregate ON event_outbox (aggregate_type, aggregate_id);

CREATE TABLE IF NOT EXISTS websocket_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    connection_id VARCHAR(120) NOT NULL,
    channel_prefix VARCHAR(60),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    last_checkpoint_at TIMESTAMPTZ,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_websocket_connections_user_id ON websocket_connections (user_id, connected_at DESC);

CREATE TABLE IF NOT EXISTS push_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ride_id UUID REFERENCES viagens(id) ON DELETE SET NULL,
    notification_type VARCHAR(60) NOT NULL,
    title VARCHAR(160),
    body TEXT,
    provider_ref VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'SENT',
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_notification_log_user_id ON push_notification_log (user_id, created_at DESC);

COMMIT;
