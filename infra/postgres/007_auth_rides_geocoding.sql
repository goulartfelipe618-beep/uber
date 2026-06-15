BEGIN;

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL,
    device_id VARCHAR(120),
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_sessions_token_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS geocoding_search_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    session_token VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_geocoding_search_sessions_token UNIQUE (session_token)
);

CREATE INDEX IF NOT EXISTS idx_geocoding_search_sessions_user ON geocoding_search_sessions (user_id);

ALTER TABLE viagens
    ADD COLUMN IF NOT EXISTS category_code VARCHAR(40);

ALTER TABLE viagens
    ADD COLUMN IF NOT EXISTS estimated_duration_min INTEGER;

ALTER TABLE viagens
    ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_viagens_category_code ON viagens (category_code);
CREATE INDEX IF NOT EXISTS idx_viagens_status_solicitada ON viagens (status, solicitada_em DESC);

COMMIT;
