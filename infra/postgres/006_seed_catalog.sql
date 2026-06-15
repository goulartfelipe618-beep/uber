BEGIN;

-- Praça padrão (Curitiba / região metropolitana simplificada)
INSERT INTO pricing_regions (id, city_code, name, priority, polygon, is_active)
VALUES (
    'a1111111-1111-4111-8111-111111111111',
    'CURITIBA',
    'Curitiba Centro Expandido',
    100,
    ST_Multi(ST_SetSRID(ST_GeomFromText(
        'POLYGON((-49.35 -25.55, -49.15 -25.55, -49.15 -25.35, -49.35 -25.35, -49.35 -25.55))'
    ), 4326)),
    TRUE
)
ON CONFLICT DO NOTHING;

INSERT INTO service_regions (id, city_code, name, operation_code, priority, polygon, is_active)
VALUES (
    'b2222222-2222-4222-8222-222222222222',
    'CURITIBA',
    'Curitiba Operacional',
    'CURITIBA_PR',
    100,
    ST_Multi(ST_SetSRID(ST_GeomFromText(
        'POLYGON((-49.35 -25.55, -49.15 -25.55, -49.15 -25.35, -49.35 -25.35, -49.35 -25.55))'
    ), 4326)),
    TRUE
)
ON CONFLICT (operation_code) DO NOTHING;

INSERT INTO pricing_rule_sets (id, code, name, description, is_active)
VALUES (
    'c3333333-3333-4333-8333-333333333333',
    'DEFAULT_BR',
    'Regras Padrão Brasil',
    'Conjunto base de tarifas conforme guia operacional',
    TRUE
)
ON CONFLICT (code) DO NOTHING;

-- Tarifa base de referência: Econômico = multiplicador 1.00
-- base_fare 5.00 | price_per_km 2.00 | price_per_minute 0.40 | minimum_fare 8.00

INSERT INTO ride_categories (
    code, name, description,
    passenger_limit_min, passenger_limit_max,
    bag_policy_json, is_shared, is_premium, is_active, active,
    base_fare, price_per_km, price_per_minute, minimum_fare,
    pricing_multipliers_json, dynamic_cap
) VALUES
(
    'MOTO', 'Moto', 'Mototáxi para 1 passageiro sem bagagem volumosa',
    1, 1,
    '{"allowed":["mochila","bolsa_pequena"],"blocked":["mala_media","mala_grande"]}'::jsonb,
    FALSE, FALSE, TRUE, TRUE,
    3.60, 1.56, 0.296, 5.60,
    '{"base_category_multiplier":0.72,"distance_rate_multiplier":0.78,"time_rate_multiplier":0.74,"minimum_fare_multiplier":0.70,"weather_risk_multiplier_light":1.05,"weather_risk_multiplier_moderate":1.15}'::jsonb,
    1.80
),
(
    'ECONOMICO', 'Econômico', 'Categoria padrão hatch ou sedã compacto',
    1, 4,
    '{"allowed":["mala_media","malas_pequenas"],"max_medium_bags":1}'::jsonb,
    FALSE, FALSE, TRUE, TRUE,
    5.00, 2.00, 0.40, 8.00,
    '{"base_category_multiplier":1.00,"distance_rate_multiplier":1.00,"time_rate_multiplier":1.00,"minimum_fare_multiplier":1.00}'::jsonb,
    2.20
),
(
    'COMFORT', 'Comfort', 'Sedã premium ou crossover com conforto superior',
    1, 4,
    '{"allowed":["malas_medias","mala_grande"],"max_medium_bags":2}'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    6.20, 2.40, 0.472, 9.76,
    '{"base_category_multiplier":1.24,"distance_rate_multiplier":1.20,"time_rate_multiplier":1.18,"minimum_fare_multiplier":1.22,"service_quality_bonus":1.03}'::jsonb,
    2.50
),
(
    'EXECUTIVO', 'Executivo', 'Sedã médio ou superior para viagens corporativas',
    1, 4,
    '{"allowed":["malas_grandes","malas_medias"],"max_large_bags":2}'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    7.25, 2.76, 0.536, 11.36,
    '{"base_category_multiplier":1.45,"distance_rate_multiplier":1.38,"time_rate_multiplier":1.34,"minimum_fare_multiplier":1.42}'::jsonb,
    2.80
),
(
    'BLACK', 'Black', 'Sedã premium preto ou cor homologada',
    1, 4,
    '{"allowed":["malas_grandes"],"max_large_bags":2}'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    9.10, 3.30, 0.632, 14.00,
    '{"base_category_multiplier":1.82,"distance_rate_multiplier":1.65,"time_rate_multiplier":1.58,"minimum_fare_multiplier":1.75}'::jsonb,
    3.00
),
(
    'SUV', 'SUV', 'SUV ou minivan para grupos e bagagem volumosa',
    1, 6,
    '{"allowed":["malas_medias","malas_grandes"],"max_medium_bags":4}'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    8.40, 3.00, 0.568, 12.40,
    '{"base_category_multiplier":1.68,"distance_rate_multiplier":1.50,"time_rate_multiplier":1.42,"minimum_fare_multiplier":1.55}'::jsonb,
    2.80
),
(
    'PET', 'Pet', 'Transporte de animais com kit de limpeza',
    1, 4,
    '{"pet_items_allowed":true,"transport_box_recommended":true}'::jsonb,
    FALSE, FALSE, TRUE, TRUE,
    5.90, 2.20, 0.432, 9.28,
    '{"base_category_multiplier":1.18,"distance_rate_multiplier":1.10,"time_rate_multiplier":1.08,"minimum_fare_multiplier":1.16}'::jsonb,
    2.30
),
(
    'ENTREGA', 'Entrega', 'Entrega de pacotes sem passageiro',
    0, 0,
    '{"mode":"package","max_weight_kg_by_vehicle":true}'::jsonb,
    FALSE, FALSE, TRUE, TRUE,
    4.80, 2.04, 0.328, 7.36,
    '{"base_category_multiplier":0.96,"distance_rate_multiplier":1.02,"time_rate_multiplier":0.82,"minimum_fare_multiplier":0.92}'::jsonb,
    2.00
),
(
    'AEROPORTO', 'Aeroporto', 'Modalidade aeroportuária sobre categoria base',
    1, 4,
    '{"airport_mode":true,"inherits_base_category":true}'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    6.10, 2.00, 0.40, 9.76,
    '{"base_category_multiplier":1.22,"airport_fee_applicable":true}'::jsonb,
    2.60
),
(
    'CORPORATIVO', 'Corporativo', 'Faturamento B2B com políticas empresariais',
    1, 4,
    '{"corporate_mode":true,"cost_center_required":true}'::jsonb,
    FALSE, TRUE, TRUE, TRUE,
    5.00, 2.00, 0.40, 8.00,
    '{"corporate_service_fee":true,"corporate_discount_factor_min":0.90,"corporate_discount_factor_max":0.98}'::jsonb,
    2.00
),
(
    'VAN', 'Van', 'Van homologada para grupos até 12 passageiros',
    1, 12,
    '{"max_medium_bag_per_passenger":1}'::jsonb,
    FALSE, FALSE, TRUE, TRUE,
    11.00, 3.76, 0.688, 16.40,
    '{"base_category_multiplier":2.20,"distance_rate_multiplier":1.88,"time_rate_multiplier":1.72,"minimum_fare_multiplier":2.05}'::jsonb,
    2.50
),
(
    'MICRO_ONIBUS', 'Micro-ônibus', 'Fretamento leve e transfer coletivo',
    1, 24,
    '{"scheduled_preferred":true,"immediate_blocked_in_some_markets":true}'::jsonb,
    FALSE, FALSE, TRUE, TRUE,
    15.50, 4.70, 0.840, 23.20,
    '{"base_category_multiplier":3.10,"distance_rate_multiplier":2.35,"time_rate_multiplier":2.10,"minimum_fare_multiplier":2.90}'::jsonb,
    2.30
),
(
    'COMPARTILHADO', 'Transporte Compartilhado', 'Viagem compartilhada com desconto por assento',
    1, 2,
    '{"shared_mode":true,"large_bags_blocked":true}'::jsonb,
    TRUE, FALSE, TRUE, TRUE,
    4.20, 1.72, 0.368, 6.40,
    '{"base_category_multiplier":0.84,"distance_rate_multiplier":0.86,"time_rate_multiplier":0.92,"minimum_fare_multiplier":0.80}'::jsonb,
    1.80
),
(
    'PCD', 'Transporte Adaptado (PCD)', 'Veículo adaptado para acessibilidade',
    1, 5,
    '{"assistive_devices_not_counted_as_baggage":true}'::jsonb,
    FALSE, FALSE, TRUE, TRUE,
    6.80, 2.44, 0.512, 10.40,
    '{"base_category_multiplier":1.36,"distance_rate_multiplier":1.22,"time_rate_multiplier":1.28,"minimum_fare_multiplier":1.30}'::jsonb,
    1.90
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    passenger_limit_min = EXCLUDED.passenger_limit_min,
    passenger_limit_max = EXCLUDED.passenger_limit_max,
    bag_policy_json = EXCLUDED.bag_policy_json,
    is_shared = EXCLUDED.is_shared,
    is_premium = EXCLUDED.is_premium,
    is_active = EXCLUDED.is_active,
    active = EXCLUDED.active,
    base_fare = EXCLUDED.base_fare,
    price_per_km = EXCLUDED.price_per_km,
    price_per_minute = EXCLUDED.price_per_minute,
    minimum_fare = EXCLUDED.minimum_fare,
    pricing_multipliers_json = EXCLUDED.pricing_multipliers_json,
    dynamic_cap = EXCLUDED.dynamic_cap,
    updated_at = NOW();

-- Requisitos por categoria (guia.txt)
INSERT INTO category_requirement_profiles (
    ride_category_id, min_driver_rating, min_completed_rides, max_cancellation_rate,
    min_acceptance_rate, min_vehicle_year, min_seat_count,
    requires_pet_ready, requires_wheelchair_accessible, requires_corporate_eligibility,
    requirements_json
)
SELECT c.id, p.min_driver_rating, p.min_completed_rides, p.max_cancellation_rate,
       p.min_acceptance_rate, p.min_vehicle_year, p.min_seat_count,
       p.requires_pet_ready, p.requires_wheelchair_accessible, p.requires_corporate_eligibility,
       p.requirements_json
FROM ride_categories c
JOIN (
    VALUES
    ('MOTO', 4.60::numeric, NULL::int, 0.12::numeric, NULL::numeric, NULL::smallint, NULL::smallint, FALSE, FALSE, FALSE, '{"min_age":21,"cnh_ear_required":true}'::jsonb),
    ('ECONOMICO', 4.50, NULL, 0.15, 0.45, NULL, 4, FALSE, FALSE, FALSE, '{"ac_required":true}'::jsonb),
    ('COMFORT', 4.75, 300, 0.10, NULL, NULL, NULL, FALSE, FALSE, FALSE, '{"comfort_inspection_required":true}'::jsonb),
    ('EXECUTIVO', 4.82, 700, NULL, 0.55, NULL, NULL, FALSE, FALSE, FALSE, '{"executive_training":true}'::jsonb),
    ('BLACK', 4.88, 1200, 0.08, NULL, NULL, NULL, FALSE, FALSE, FALSE, '{"premium_training":true}'::jsonb),
    ('SUV', 4.80, 500, 0.10, NULL, NULL, 6, FALSE, FALSE, FALSE, '{}'::jsonb),
    ('PET', 4.65, NULL, NULL, NULL, NULL, NULL, TRUE, FALSE, FALSE, '{"pet_training":true}'::jsonb),
    ('ENTREGA', 4.50, NULL, NULL, NULL, NULL, NULL, FALSE, FALSE, FALSE, '{}'::jsonb),
    ('AEROPORTO', 4.70, 250, NULL, NULL, NULL, NULL, FALSE, FALSE, FALSE, '{"airport_training":true}'::jsonb),
    ('CORPORATIVO', 4.78, NULL, 0.09, NULL, NULL, NULL, FALSE, FALSE, TRUE, '{"b2b_billing":true}'::jsonb),
    ('VAN', 4.75, NULL, NULL, NULL, NULL, NULL, FALSE, FALSE, FALSE, '{"collective_training":true}'::jsonb),
    ('MICRO_ONIBUS', 4.80, NULL, NULL, NULL, NULL, NULL, FALSE, FALSE, FALSE, '{"collective_certification":true}'::jsonb),
    ('COMPARTILHADO', 4.68, NULL, NULL, 0.50, NULL, 4, FALSE, FALSE, FALSE, '{}'::jsonb),
    ('PCD', 4.75, NULL, NULL, NULL, NULL, NULL, FALSE, TRUE, FALSE, '{"inclusive_training":true}'::jsonb)
) AS p(code, min_driver_rating, min_completed_rides, max_cancellation_rate, min_acceptance_rate, min_vehicle_year, min_seat_count, requires_pet_ready, requires_wheelchair_accessible, requires_corporate_eligibility, requirements_json)
    ON c.code = p.code
ON CONFLICT (ride_category_id) DO UPDATE SET
    min_driver_rating = EXCLUDED.min_driver_rating,
    min_completed_rides = EXCLUDED.min_completed_rides,
    max_cancellation_rate = EXCLUDED.max_cancellation_rate,
    min_acceptance_rate = EXCLUDED.min_acceptance_rate,
    min_vehicle_year = EXCLUDED.min_vehicle_year,
    min_seat_count = EXCLUDED.min_seat_count,
    requires_pet_ready = EXCLUDED.requires_pet_ready,
    requires_wheelchair_accessible = EXCLUDED.requires_wheelchair_accessible,
    requires_corporate_eligibility = EXCLUDED.requires_corporate_eligibility,
    requirements_json = EXCLUDED.requirements_json,
    updated_at = NOW();

-- Disponibilidade por região
INSERT INTO service_region_categories (service_region_id, ride_category_id, is_enabled)
SELECT 'b2222222-2222-4222-8222-222222222222', c.id, TRUE
FROM ride_categories c
WHERE c.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- Tags de avaliação
INSERT INTO review_tags (code, name, tag_group) VALUES
    ('PONTUALIDADE', 'Pontualidade', 'quality'),
    ('CORDIALIDADE', 'Cordialidade', 'quality'),
    ('DIRECAO', 'Direção', 'quality'),
    ('LIMPEZA', 'Limpeza', 'quality'),
    ('RESPEITO', 'Respeito', 'quality'),
    ('SEGURANCA', 'Segurança', 'quality'),
    ('COMPORTAMENTO', 'Comportamento', 'quality'),
    ('LOCALIZACAO_INCORRETA', 'Localização incorreta', 'issue'),
    ('ATRASO', 'Atraso', 'issue'),
    ('BAGAGEM', 'Bagagem', 'context'),
    ('PET', 'Pet', 'context'),
    ('PCD', 'PCD', 'context'),
    ('PAGAMENTO', 'Pagamento', 'context'),
    ('ROTA', 'Rota', 'context')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, tag_group = EXCLUDED.tag_group;

-- Versões de pricing por categoria na região padrão
INSERT INTO pricing_rule_versions (
    rule_set_id, category_id, region_id,
    effective_from, base_fare_centavos, distance_rate_centavos_km,
    time_rate_centavos_min, minimum_fare_centavos, booking_fee_centavos,
    traffic_coefficient, take_rate_bps, driver_dynamic_share_bps, config_json
)
SELECT
    'c3333333-3333-4333-8333-333333333333',
    c.id,
    'a1111111-1111-4111-8111-111111111111',
    NOW(),
    (c.base_fare * 100)::bigint,
    (c.price_per_km * 100)::bigint,
    (c.price_per_minute * 100)::bigint,
    (c.minimum_fare * 100)::bigint,
    200,
    0.15,
    CASE WHEN c.is_premium THEN 2200 ELSE 2000 END,
    7500,
    jsonb_build_object('dynamic_cap', c.dynamic_cap, 'multipliers', c.pricing_multipliers_json)
FROM ride_categories c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM pricing_rule_versions prv
      WHERE prv.category_id = c.id
        AND prv.region_id = 'a1111111-1111-4111-8111-111111111111'
        AND prv.effective_to IS NULL
  );

COMMIT;
