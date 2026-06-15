CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_usuario') THEN
        CREATE TYPE tipo_usuario AS ENUM ('PASSAGEIRO', 'MOTORISTA', 'ADMIN');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_viagem') THEN
        CREATE TYPE status_viagem AS ENUM (
            'SOLICITADA',
            'MOTORISTA_A_CAMINHO',
            'MOTORISTA_CHEGOU',
            'EM_ANDAMENTO',
            'CONCLUIDA',
            'CANCELADA'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_motorista') THEN
        CREATE TYPE status_motorista AS ENUM ('OFFLINE', 'ONLINE', 'EM_CORRIDA');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    telefone VARCHAR(20) NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    tipo tipo_usuario NOT NULL,
    documento VARCHAR(20),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_tipo ON usuarios (tipo);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios (ativo);

CREATE TABLE IF NOT EXISTS viagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passageiro_id UUID NOT NULL REFERENCES usuarios(id),
    motorista_id UUID REFERENCES usuarios(id),
    status status_viagem NOT NULL DEFAULT 'SOLICITADA',
    origem geometry(Point, 4326) NOT NULL,
    destino geometry(Point, 4326) NOT NULL,
    origem_endereco TEXT,
    destino_endereco TEXT,
    distancia_estimada_m INTEGER,
    distancia_real_m INTEGER,
    valor_estimado_centavos BIGINT,
    valor_final_centavos BIGINT,
    solicitada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aceita_em TIMESTAMPTZ,
    iniciada_em TIMESTAMPTZ,
    finalizada_em TIMESTAMPTZ,
    cancelada_em TIMESTAMPTZ,
    observacoes TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_viagens_passageiro_id ON viagens (passageiro_id);
CREATE INDEX IF NOT EXISTS idx_viagens_motorista_id ON viagens (motorista_id);
CREATE INDEX IF NOT EXISTS idx_viagens_status ON viagens (status);
CREATE INDEX IF NOT EXISTS idx_viagens_solicitada_em ON viagens (solicitada_em DESC);
CREATE INDEX IF NOT EXISTS idx_viagens_origem_gist ON viagens USING GIST (origem);
CREATE INDEX IF NOT EXISTS idx_viagens_destino_gist ON viagens USING GIST (destino);

CREATE TABLE IF NOT EXISTS localizacoes_motoristas (
    motorista_id UUID PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    localizacao geometry(Point, 4326) NOT NULL,
    heading SMALLINT,
    velocidade_kmh NUMERIC(6,2),
    precisao_m NUMERIC(8,2),
    status status_motorista NOT NULL DEFAULT 'OFFLINE',
    viagem_atual_id UUID REFERENCES viagens(id),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_localizacoes_motoristas_gist
    ON localizacoes_motoristas USING GIST (localizacao);

CREATE INDEX IF NOT EXISTS idx_localizacoes_motoristas_status
    ON localizacoes_motoristas (status);

CREATE INDEX IF NOT EXISTS idx_localizacoes_motoristas_atualizado_em
    ON localizacoes_motoristas (atualizado_em DESC);

COMMENT ON TABLE usuarios IS 'Cadastro base de usuários, motoristas e administradores.';
COMMENT ON TABLE viagens IS 'Solicitações e execuções de corridas.';
COMMENT ON TABLE localizacoes_motoristas IS 'Última posição conhecida de cada motorista para busca e match em tempo real.';
