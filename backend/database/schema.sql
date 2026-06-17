-- =============================================================================
-- BEEL — SCHEMA COMPLETO DE POSTGRESQL
-- Versión: MVP v1
-- Última actualización: Fase 4
--
-- Principios de diseño:
--   1. UUIDs como PKs — seguridad y compatibilidad con sistemas distribuidos
--   2. Soft deletes con deleted_at — preserva historial y auditoría
--   3. Snapshots en reservas — los datos de precio/política no cambian post-reserva
--   4. Analytics desde día 1 — JSONB flexible para captura de comportamiento
--   5. Transport-agnostic messaging — compatible con SSE y futura migración a WS
--   6. Índices estratégicos — solo los necesarios para los queries reales del MVP
-- =============================================================================


-- =============================================================================
-- EXTENSIONES
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "unaccent";       -- búsqueda sin acentos
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- búsqueda por similitud de texto
CREATE EXTENSION IF NOT EXISTS "cube";           -- dependencia de earthdistance
CREATE EXTENSION IF NOT EXISTS "earthdistance";  -- búsqueda por proximidad geográfica


-- =============================================================================
-- FUNCIÓN: AUTO-ACTUALIZACIÓN DE updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Macro para aplicar el trigger a cualquier tabla
CREATE OR REPLACE FUNCTION create_updated_at_trigger(p_table TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
         CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at()',
        p_table
    );
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- MÓDULO: USUARIOS Y AUTENTICACIÓN
-- =============================================================================

CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Clerk gestiona la autenticación. Este ID vincula ambos sistemas.
    clerk_id                VARCHAR(255) UNIQUE NOT NULL,
    email                   VARCHAR(255) UNIQUE NOT NULL,
    phone                   VARCHAR(30),
    phone_country_code      VARCHAR(5) DEFAULT '+52',
    full_name               VARCHAR(255) NOT NULL,
    avatar_url              TEXT,
    -- 'guest' puede convertirse en 'host' sin crear nueva cuenta
    role                    VARCHAR(20) NOT NULL DEFAULT 'guest'
                            CHECK (role IN ('guest', 'host', 'admin')),
    is_phone_verified       BOOLEAN DEFAULT FALSE,
    is_identity_verified    BOOLEAN DEFAULT FALSE,
    is_active               BOOLEAN DEFAULT TRUE,
    preferred_language      VARCHAR(5) DEFAULT 'es',
    -- Metadatos de negocio
    host_since              TIMESTAMPTZ,        -- se llena cuando role cambia a host
    total_listings          INTEGER DEFAULT 0,
    total_trips             INTEGER DEFAULT 0,
    -- Soft delete
    deleted_at              TIMESTAMPTZ,
    -- Auditoría
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_updated_at_trigger('users');

CREATE INDEX idx_users_clerk_id     ON users(clerk_id);
CREATE INDEX idx_users_email        ON users(email);
CREATE INDEX idx_users_role         ON users(role) WHERE deleted_at IS NULL;


-- Verificaciones de identidad (revisión manual por admin en MVP v1)
CREATE TABLE identity_verifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type       VARCHAR(50)
                        CHECK (document_type IN ('INE', 'pasaporte', 'cedula',
                                                 'licencia', 'otro')),
    document_front_url  TEXT NOT NULL,
    document_back_url   TEXT,
    selfie_url          TEXT NOT NULL,
    status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_updated_at_trigger('identity_verifications');

CREATE INDEX idx_identity_verif_user_id ON identity_verifications(user_id);
CREATE INDEX idx_identity_verif_status  ON identity_verifications(status)
    WHERE status = 'pending';


-- =============================================================================
-- MÓDULO: PROPIEDADES
-- =============================================================================

CREATE TABLE properties (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id                 UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- Información básica
    title                   VARCHAR(255) NOT NULL,
    description             TEXT NOT NULL,
    property_type           VARCHAR(50) NOT NULL
                            CHECK (property_type IN (
                                'casa', 'departamento', 'cabaña',
                                'villa', 'habitacion', 'hostal', 'otro'
                            )),

    -- Estado del listing
    status                  VARCHAR(30) DEFAULT 'pending_review'
                            CHECK (status IN (
                                'pending_review', -- esperando aprobación admin
                                'active',         -- visible y reservable
                                'inactive',       -- oculto por el host
                                'suspended',      -- bloqueado por admin
                                'deleted'         -- soft delete
                            )),

    -- Ubicación
    address                 VARCHAR(500) NOT NULL,
    neighborhood            VARCHAR(255),
    city                    VARCHAR(100) NOT NULL DEFAULT 'Mérida',
    state                   VARCHAR(100) NOT NULL DEFAULT 'Yucatán',
    country                 VARCHAR(100) NOT NULL DEFAULT 'México',
    country_code            VARCHAR(3) DEFAULT 'MX',
    postal_code             VARCHAR(20),
    -- Coordenadas exactas (no visibles al público hasta confirmación de reserva)
    latitude                DECIMAL(10, 8) NOT NULL,
    longitude               DECIMAL(11, 8) NOT NULL,
    -- Coordenadas aproximadas para mapa público (radio de ~150m)
    latitude_approx         DECIMAL(8, 5),
    longitude_approx        DECIMAL(8, 5),

    -- Capacidad
    max_guests              SMALLINT NOT NULL CHECK (max_guests > 0),
    bedrooms                SMALLINT NOT NULL DEFAULT 1 CHECK (bedrooms >= 0),
    beds                    SMALLINT NOT NULL DEFAULT 1 CHECK (beds > 0),
    bathrooms               DECIMAL(3, 1) NOT NULL DEFAULT 1.0,

    -- Precios
    price_per_night         DECIMAL(10, 2) NOT NULL CHECK (price_per_night > 0),
    currency                VARCHAR(3) DEFAULT 'MXN',
    cleaning_fee            DECIMAL(10, 2) DEFAULT 0 CHECK (cleaning_fee >= 0),
    security_deposit        DECIMAL(10, 2) DEFAULT 0,
    min_stay_nights         SMALLINT DEFAULT 1 CHECK (min_stay_nights > 0),
    max_stay_nights         SMALLINT DEFAULT 30,

    -- Políticas
    cancellation_policy     VARCHAR(20) DEFAULT 'flexible'
                            CHECK (cancellation_policy IN (
                                'flexible',   -- 48h antes sin costo
                                'moderate',   -- 7 días antes sin costo
                                'strict'      -- sin reembolso
                            )),
    check_in_time           TIME DEFAULT '15:00',
    check_out_time          TIME DEFAULT '11:00',
    instant_booking         BOOLEAN DEFAULT FALSE,
    allows_pets             BOOLEAN DEFAULT FALSE,
    allows_smoking          BOOLEAN DEFAULT FALSE,
    allows_events           BOOLEAN DEFAULT FALSE,

    -- Métricas cacheadas (actualizadas por triggers/jobs)
    total_reviews           INTEGER DEFAULT 0,
    avg_rating              DECIMAL(3, 2) CHECK (avg_rating BETWEEN 1 AND 5),
    avg_cleanliness         DECIMAL(3, 2),
    avg_communication       DECIMAL(3, 2),
    avg_location            DECIMAL(3, 2),
    avg_value               DECIMAL(3, 2),
    total_bookings          INTEGER DEFAULT 0,
    -- Score de ranking (recalculado por job cada hora)
    ranking_score           DECIMAL(8, 4) DEFAULT 0,

    -- Full-text search vector (actualizado por trigger)
    search_vector           TSVECTOR,

    -- Aprobación administrativa
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMPTZ,
    suspension_reason       TEXT,

    -- Soft delete
    deleted_at              TIMESTAMPTZ,

    -- Auditoría
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_updated_at_trigger('properties');

-- Índices de búsqueda críticos
CREATE INDEX idx_properties_status      ON properties(status)
    WHERE deleted_at IS NULL;
CREATE INDEX idx_properties_host_id     ON properties(host_id);
CREATE INDEX idx_properties_city        ON properties(city)
    WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_properties_price       ON properties(price_per_night)
    WHERE status = 'active';
CREATE INDEX idx_properties_ranking     ON properties(ranking_score DESC)
    WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_properties_type        ON properties(property_type)
    WHERE status = 'active';
CREATE INDEX idx_properties_guests      ON properties(max_guests)
    WHERE status = 'active';

-- Índice geoespacial para búsqueda por proximidad con earthdistance
CREATE INDEX idx_properties_geo
    ON properties USING GIST (
        ll_to_earth(latitude::float8, longitude::float8)
    )
    WHERE status = 'active' AND deleted_at IS NULL;

-- Índice de full-text search
CREATE INDEX idx_properties_search_vector
    ON properties USING GIN(search_vector);

-- Trigger para mantener search_vector actualizado
CREATE OR REPLACE FUNCTION fn_update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('spanish', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('spanish', coalesce(NEW.description, '')), 'B') ||
        setweight(to_tsvector('spanish', coalesce(NEW.neighborhood, '')), 'C') ||
        setweight(to_tsvector('spanish', coalesce(NEW.city, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_properties_search_vector
    BEFORE INSERT OR UPDATE OF title, description, neighborhood, city
    ON properties
    FOR EACH ROW EXECUTE FUNCTION fn_update_search_vector();


-- Fotos de propiedades
CREATE TABLE property_photos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,          -- URL en S3
    thumbnail_url   TEXT,                   -- versión 400x300 generada automáticamente
    display_order   SMALLINT NOT NULL DEFAULT 0,
    is_primary      BOOLEAN DEFAULT FALSE,
    caption         VARCHAR(255),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_property_photos_property ON property_photos(property_id, display_order);

-- Solo una foto puede ser primary por propiedad
CREATE UNIQUE INDEX idx_property_photos_primary
    ON property_photos(property_id)
    WHERE is_primary = TRUE;


-- Catálogo de amenidades
CREATE TABLE amenities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        VARCHAR(100) UNIQUE NOT NULL,    -- 'wifi', 'aire_acondicionado'
    name_es     VARCHAR(100) NOT NULL,
    name_en     VARCHAR(100),
    name_pt     VARCHAR(100),
    icon        VARCHAR(100),                    -- nombre del ícono Lucide
    category    VARCHAR(50) NOT NULL
                CHECK (category IN (
                    'basicos', 'cocina', 'bano', 'dormitorio',
                    'exterior', 'seguridad', 'entretenimiento',
                    'accesibilidad', 'servicios'
                )),
    is_highlight BOOLEAN DEFAULT FALSE,          -- aparece destacado en el listing
    sort_order  SMALLINT DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE property_amenities (
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    amenity_id  UUID NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
    PRIMARY KEY (property_id, amenity_id)
);

CREATE INDEX idx_property_amenities_property ON property_amenities(property_id);


-- Reglas adicionales del listing (texto libre del host)
CREATE TABLE property_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    rule_text   VARCHAR(500) NOT NULL,
    sort_order  SMALLINT DEFAULT 0
);

CREATE INDEX idx_property_rules_property ON property_rules(property_id);


-- =============================================================================
-- MÓDULO: DISPONIBILIDAD
-- =============================================================================
--
-- Estrategia: almacenamos cada fecha explícitamente.
-- Ventajas:
--   - Consulta O(1) por fecha (vs calcular rangos)
--   - Soporte nativo de precios por temporada (price_override)
--   - Facilita sincronización futura con iCal
--
-- Generación: cuando un host publica, generamos 365 días hacia adelante
-- con is_available = TRUE. Los jobs nocturnos extienden el horizonte.
-- =============================================================================

CREATE TABLE availability (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    is_available    BOOLEAN DEFAULT TRUE,
    -- Precio especial para esta fecha (NULL = usar price_per_night del listing)
    price_override  DECIMAL(10, 2) CHECK (price_override > 0),
    -- Razón de bloqueo (para auditoría y sincronización futura con iCal)
    blocked_reason  VARCHAR(50)
                    CHECK (blocked_reason IN (
                        'reservation',      -- bloqueado por reserva activa
                        'owner_use',        -- uso personal del anfitrión
                        'maintenance',      -- mantenimiento
                        'external_sync'     -- sincronizado desde Airbnb/iCal
                    )),
    reservation_id  UUID,   -- FK a reservations (se añade después con ALTER TABLE
                            -- para evitar dependencia circular)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (property_id, date)
);

SELECT create_updated_at_trigger('availability');

-- Índice compuesto crítico para queries de búsqueda por rango de fechas
CREATE INDEX idx_availability_property_date
    ON availability(property_id, date)
    WHERE is_available = TRUE;

CREATE INDEX idx_availability_date_available
    ON availability(date, is_available)
    WHERE is_available = TRUE;


-- =============================================================================
-- MÓDULO: RESERVAS
-- =============================================================================
--
-- Principio de snapshot: precio, moneda y política de cancelación se copian
-- al momento de crear la reserva. Si el host cambia su precio después,
-- las reservas existentes no se ven afectadas.
-- =============================================================================

CREATE TABLE reservations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Referencia a las partes
    property_id                 UUID NOT NULL REFERENCES properties(id)
                                ON DELETE RESTRICT,
    guest_id                    UUID NOT NULL REFERENCES users(id)
                                ON DELETE RESTRICT,
    host_id                     UUID NOT NULL REFERENCES users(id)
                                ON DELETE RESTRICT,

    -- Fechas
    check_in                    DATE NOT NULL,
    check_out                   DATE NOT NULL,
    nights                      SMALLINT NOT NULL
                                GENERATED ALWAYS AS
                                (check_out - check_in) STORED,

    -- Snapshot de precios al momento de la reserva
    guests_count                SMALLINT NOT NULL CHECK (guests_count > 0),
    price_per_night_snapshot    DECIMAL(10, 2) NOT NULL,
    cleaning_fee_snapshot       DECIMAL(10, 2) DEFAULT 0,
    security_deposit_snapshot   DECIMAL(10, 2) DEFAULT 0,
    subtotal                    DECIMAL(10, 2) NOT NULL,
    platform_fee                DECIMAL(10, 2) DEFAULT 0,
    platform_fee_pct            DECIMAL(5, 2) DEFAULT 0,
    total_amount                DECIMAL(10, 2) NOT NULL,
    currency                    VARCHAR(3) DEFAULT 'MXN',

    -- Estado del ciclo de vida
    status                      VARCHAR(30) DEFAULT 'pending'
                                CHECK (status IN (
                                    'pending',          -- solicitud enviada, esperando host
                                    'accepted',         -- host aceptó, pago pendiente
                                    'payment_pending',  -- pago iniciado
                                    'confirmed',        -- pago confirmado
                                    'active',           -- huésped ya hizo check-in
                                    'completed',        -- check-out realizado
                                    'cancelled_guest',  -- cancelado por huésped
                                    'cancelled_host',   -- cancelado por anfitrión
                                    'cancelled_admin',  -- cancelado por admin
                                    'no_show',          -- huésped no se presentó
                                    'rejected'          -- host rechazó la solicitud
                                )),

    -- Estado del pago (independiente del status de reserva)
    payment_status              VARCHAR(20) DEFAULT 'unpaid'
                                CHECK (payment_status IN (
                                    'unpaid',       -- sin pago iniciado
                                    'pending',      -- pago en proceso
                                    'paid',         -- pago confirmado
                                    'partial',      -- depósito pagado
                                    'refunded',     -- reembolso completo
                                    'partial_refund', -- reembolso parcial
                                    'failed'        -- pago fallido
                                )),

    -- Snapshot de política de cancelación al momento de reservar
    cancellation_policy_snapshot VARCHAR(20),

    -- Mensajes del sistema
    guest_message               TEXT,           -- mensaje inicial del huésped
    rejection_reason            TEXT,
    cancellation_reason         TEXT,
    cancelled_by                UUID REFERENCES users(id),

    -- Timestamps del ciclo de vida
    accepted_at                 TIMESTAMPTZ,
    confirmed_at                TIMESTAMPTZ,    -- post pago confirmado
    cancelled_at                TIMESTAMPTZ,
    completed_at                TIMESTAMPTZ,
    no_show_at                  TIMESTAMPTZ,

    -- Auditoría
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW(),

    -- Constraint: check_out debe ser posterior a check_in
    CONSTRAINT chk_dates CHECK (check_out > check_in),
    -- Constraint: monto positivo
    CONSTRAINT chk_total CHECK (total_amount > 0)
);

SELECT create_updated_at_trigger('reservations');

CREATE INDEX idx_reservations_property  ON reservations(property_id);
CREATE INDEX idx_reservations_guest     ON reservations(guest_id);
CREATE INDEX idx_reservations_host      ON reservations(host_id);
CREATE INDEX idx_reservations_status    ON reservations(status);
CREATE INDEX idx_reservations_dates     ON reservations(check_in, check_out);
CREATE INDEX idx_reservations_created   ON reservations(created_at DESC);

-- FK circular resuelta con ALTER TABLE
ALTER TABLE availability
    ADD CONSTRAINT fk_availability_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    ON DELETE SET NULL;


-- =============================================================================
-- MÓDULO: PAGOS
-- =============================================================================

CREATE TABLE payments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id          UUID NOT NULL REFERENCES reservations(id)
                            ON DELETE RESTRICT,

    -- Datos financieros
    amount                  DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    currency                VARCHAR(3) DEFAULT 'MXN',
    payment_type            VARCHAR(20) DEFAULT 'full'
                            CHECK (payment_type IN (
                                'full',             -- pago total
                                'deposit',          -- depósito inicial
                                'remainder',        -- resto del pago
                                'refund',           -- reembolso al huésped
                                'payout'            -- pago al anfitrión
                            )),

    -- Proveedor de pago
    payment_provider        VARCHAR(20) NOT NULL
                            CHECK (payment_provider IN (
                                'mercadopago', 'stripe', 'manual'
                            )),
    provider_payment_id     VARCHAR(255) UNIQUE,    -- ID único del proveedor
    provider_status         VARCHAR(50),            -- status raw del proveedor
    provider_response       JSONB,                  -- webhook completo del proveedor

    -- Método de pago usado
    payment_method          VARCHAR(50)
                            CHECK (payment_method IN (
                                'credit_card', 'debit_card',
                                'oxxo', 'spei',
                                'mercadopago_wallet',
                                'stripe_card', 'bank_transfer', 'manual'
                            )),
    payment_method_last4    VARCHAR(4),             -- últimos 4 dígitos si es tarjeta

    -- Estado de nuestro sistema
    status                  VARCHAR(20) DEFAULT 'pending'
                            CHECK (status IN (
                                'pending', 'processing', 'completed',
                                'failed', 'refunded', 'cancelled'
                            )),

    -- Payout al anfitrión
    payout_status           VARCHAR(20) DEFAULT 'pending'
                            CHECK (payout_status IN (
                                'pending', 'scheduled', 'processing',
                                'paid', 'failed', 'on_hold'
                            )),
    payout_scheduled_at     TIMESTAMPTZ,    -- 24h después del check-in
    payout_completed_at     TIMESTAMPTZ,
    payout_provider_id      VARCHAR(255),   -- ID de la transferencia al host

    -- Comisiones
    platform_fee_amount     DECIMAL(10, 2) DEFAULT 0,
    processing_fee_amount   DECIMAL(10, 2) DEFAULT 0,
    net_amount_to_host      DECIMAL(10, 2),

    -- Auditoría
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

SELECT create_updated_at_trigger('payments');

CREATE INDEX idx_payments_reservation   ON payments(reservation_id);
CREATE INDEX idx_payments_provider_id   ON payments(provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;
CREATE INDEX idx_payments_status        ON payments(status);
CREATE INDEX idx_payments_payout        ON payments(payout_status)
    WHERE payout_status = 'pending';


-- Registro de webhooks recibidos (idempotencia garantizada)
CREATE TABLE payment_webhooks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider            VARCHAR(20) NOT NULL,
    event_type          VARCHAR(100) NOT NULL,
    provider_event_id   VARCHAR(255) UNIQUE NOT NULL,  -- garantiza idempotencia
    payload             JSONB NOT NULL,
    processed           BOOLEAN DEFAULT FALSE,
    processed_at        TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_provider_event
    ON payment_webhooks(provider, provider_event_id);
CREATE INDEX idx_webhooks_unprocessed
    ON payment_webhooks(processed, created_at)
    WHERE processed = FALSE;


-- =============================================================================
-- MÓDULO: MENSAJERÍA
-- =============================================================================
--
-- Diseño transport-agnostic: este schema funciona igual para SSE y WebSockets.
-- La única diferencia entre SSE y WS está en el código FastAPI (router.py)
-- y en el hook de React. La base de datos y Redis Pub/Sub son idénticos.
--
-- Para migrar de SSE a WebSockets:
--   Backend: cambiar StreamingResponse por @router.websocket en messaging/router.py
--   Frontend: cambiar EventSource por WebSocket en hooks/useChat.ts
--   Base de datos: sin cambios.
-- =============================================================================

CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    host_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Cache del último mensaje para mostrar preview sin JOIN
    last_message_preview    VARCHAR(255),
    last_message_at         TIMESTAMPTZ,
    last_message_sender_id  UUID REFERENCES users(id),
    -- Contadores de mensajes no leídos (actualizados por trigger)
    unread_count_host       INTEGER DEFAULT 0,
    unread_count_guest      INTEGER DEFAULT 0,
    -- Una propiedad puede tener mensajes pre-reserva
    is_pre_booking          BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    -- No puede existir una conversación duplicada para la misma reserva
    UNIQUE (reservation_id) DEFERRABLE INITIALLY DEFERRED
);

SELECT create_updated_at_trigger('conversations');

CREATE INDEX idx_conversations_guest        ON conversations(guest_id, last_message_at DESC);
CREATE INDEX idx_conversations_host         ON conversations(host_id, last_message_at DESC);
CREATE INDEX idx_conversations_reservation  ON conversations(reservation_id);
CREATE INDEX idx_conversations_property     ON conversations(property_id);


CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content         TEXT NOT NULL CHECK (length(content) > 0
                                    AND length(content) <= 2000),
    message_type    VARCHAR(20) DEFAULT 'text'
                    CHECK (message_type IN (
                        'text',
                        'system',           -- mensajes automáticos de Beel
                        'reservation_update' -- cambio de estado de reserva
                    )),
    -- Para mensajes de sistema, datos adicionales estructurados
    metadata        JSONB,
    -- Control de lectura
    is_read         BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    -- Soft delete (el usuario puede "borrar" su mensaje pero se conserva)
    deleted_by_sender   BOOLEAN DEFAULT FALSE,
    -- Auditoría
    created_at      TIMESTAMPTZ DEFAULT NOW()
    -- No tiene updated_at: los mensajes no se editan
);

-- Índice crítico para cargar mensajes de una conversación en orden
CREATE INDEX idx_messages_conversation_time
    ON messages(conversation_id, created_at ASC);

-- Índice para polling: "mensajes nuevos desde timestamp X"
CREATE INDEX idx_messages_since
    ON messages(conversation_id, created_at DESC)
    WHERE is_read = FALSE;

-- Trigger: actualizar preview de conversación al insertar mensaje
CREATE OR REPLACE FUNCTION fn_update_conversation_preview()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations SET
        last_message_preview = LEFT(NEW.content, 255),
        last_message_at      = NEW.created_at,
        last_message_sender_id = NEW.sender_id,
        -- Incrementar contador de no leídos para el receptor
        unread_count_host  = CASE
            WHEN (SELECT host_id FROM conversations WHERE id = NEW.conversation_id)
                 = NEW.sender_id
            THEN unread_count_host
            ELSE unread_count_host + 1
        END,
        unread_count_guest = CASE
            WHEN (SELECT guest_id FROM conversations WHERE id = NEW.conversation_id)
                 = NEW.sender_id
            THEN unread_count_guest
            ELSE unread_count_guest + 1
        END
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_messages_update_conversation
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION fn_update_conversation_preview();


-- =============================================================================
-- MÓDULO: RESEÑAS
-- =============================================================================
--
-- Sistema bidireccional: host califica al huésped y viceversa.
-- Las reseñas permanecen ocultas hasta que ambas partes califican
-- o hasta que vence el período de 7 días.
-- =============================================================================

CREATE TABLE reviews (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id      UUID NOT NULL REFERENCES reservations(id)
                        ON DELETE RESTRICT,
    property_id         UUID NOT NULL REFERENCES properties(id)
                        ON DELETE CASCADE,
    reviewer_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewee_id         UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    review_type         VARCHAR(20) NOT NULL
                        CHECK (review_type IN (
                            'guest_to_host',    -- huésped califica propiedad/host
                            'host_to_guest'     -- host califica al huésped
                        )),

    -- Calificaciones (guest_to_host usa todas; host_to_guest solo overall)
    overall_rating      SMALLINT NOT NULL
                        CHECK (overall_rating BETWEEN 1 AND 5),
    cleanliness_rating  SMALLINT CHECK (cleanliness_rating BETWEEN 1 AND 5),
    communication_rating SMALLINT CHECK (communication_rating BETWEEN 1 AND 5),
    location_rating     SMALLINT CHECK (location_rating BETWEEN 1 AND 5),
    value_rating        SMALLINT CHECK (value_rating BETWEEN 1 AND 5),

    -- Contenido
    comment             TEXT CHECK (length(comment) <= 1000),

    -- Control de publicación (oculto hasta que ambas partes califican)
    is_published        BOOLEAN DEFAULT FALSE,
    published_at        TIMESTAMPTZ,

    -- Respuesta del calificado (el host puede responder a la reseña del huésped)
    response_text       TEXT CHECK (length(response_text) <= 500),
    response_at         TIMESTAMPTZ,

    -- Auditoría
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    -- Una reseña por tipo por reserva
    UNIQUE (reservation_id, review_type)
);

SELECT create_updated_at_trigger('reviews');

CREATE INDEX idx_reviews_property   ON reviews(property_id)
    WHERE is_published = TRUE;
CREATE INDEX idx_reviews_reviewee   ON reviews(reviewee_id)
    WHERE is_published = TRUE;
CREATE INDEX idx_reviews_reviewer   ON reviews(reviewer_id);
CREATE INDEX idx_reviews_pending    ON reviews(reservation_id)
    WHERE is_published = FALSE;

-- Trigger: actualizar métricas cacheadas de la propiedad al publicar reseña
CREATE OR REPLACE FUNCTION fn_update_property_ratings()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_published = TRUE AND NEW.review_type = 'guest_to_host' THEN
        UPDATE properties SET
            total_reviews    = (
                SELECT COUNT(*) FROM reviews
                WHERE property_id = NEW.property_id
                AND is_published = TRUE
                AND review_type = 'guest_to_host'
            ),
            avg_rating       = (
                SELECT ROUND(AVG(overall_rating)::numeric, 2) FROM reviews
                WHERE property_id = NEW.property_id
                AND is_published = TRUE
                AND review_type = 'guest_to_host'
            ),
            avg_cleanliness  = (
                SELECT ROUND(AVG(cleanliness_rating)::numeric, 2) FROM reviews
                WHERE property_id = NEW.property_id
                AND is_published = TRUE
                AND review_type = 'guest_to_host'
            ),
            avg_communication = (
                SELECT ROUND(AVG(communication_rating)::numeric, 2) FROM reviews
                WHERE property_id = NEW.property_id
                AND is_published = TRUE
                AND review_type = 'guest_to_host'
            ),
            avg_location     = (
                SELECT ROUND(AVG(location_rating)::numeric, 2) FROM reviews
                WHERE property_id = NEW.property_id
                AND is_published = TRUE
                AND review_type = 'guest_to_host'
            ),
            avg_value        = (
                SELECT ROUND(AVG(value_rating)::numeric, 2) FROM reviews
                WHERE property_id = NEW.property_id
                AND is_published = TRUE
                AND review_type = 'guest_to_host'
            )
        WHERE id = NEW.property_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_update_property_ratings
    AFTER INSERT OR UPDATE OF is_published ON reviews
    FOR EACH ROW EXECUTE FUNCTION fn_update_property_ratings();


-- =============================================================================
-- MÓDULO: NOTIFICACIONES
-- =============================================================================

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Tipo de evento que originó la notificación
    type            VARCHAR(60) NOT NULL
                    CHECK (type IN (
                        'reservation_request',
                        'reservation_accepted',
                        'reservation_rejected',
                        'reservation_cancelled',
                        'reservation_confirmed',
                        'payment_received',
                        'payment_failed',
                        'new_message',
                        'checkin_reminder',
                        'checkout_reminder',
                        'review_request',
                        'review_received',
                        'identity_approved',
                        'identity_rejected',
                        'listing_approved',
                        'listing_suspended',
                        'payout_processed'
                    )),

    -- Contenido
    title           VARCHAR(255),
    body            TEXT,
    -- Datos del evento para construir links y contexto
    data            JSONB,  -- ej: {"reservation_id": "...", "property_id": "..."}

    -- Control de envío por canal
    send_email      BOOLEAN DEFAULT TRUE,
    send_whatsapp   BOOLEAN DEFAULT TRUE,
    send_in_app     BOOLEAN DEFAULT TRUE,

    -- Estado de envío por canal
    email_sent      BOOLEAN DEFAULT FALSE,
    email_sent_at   TIMESTAMPTZ,
    email_error     TEXT,

    whatsapp_sent   BOOLEAN DEFAULT FALSE,
    whatsapp_sent_at TIMESTAMPTZ,
    whatsapp_error  TEXT,
    whatsapp_message_id VARCHAR(255),   -- ID de mensaje de 360dialog/Twilio

    -- Leída en la app
    is_read         BOOLEAN DEFAULT FALSE,
    read_at         TIMESTAMPTZ,

    -- Auditoría
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user     ON notifications(user_id, created_at DESC)
    WHERE is_read = FALSE;
CREATE INDEX idx_notifications_pending  ON notifications(created_at)
    WHERE (send_email = TRUE AND email_sent = FALSE)
       OR (send_whatsapp = TRUE AND whatsapp_sent = FALSE);


-- =============================================================================
-- MÓDULO: ANALYTICS Y CAPTURA DE COMPORTAMIENTO
-- =============================================================================
--
-- Propósito: capturar señales de comportamiento desde el día 1
-- para poder construir motores de recomendación, sistemas de ranking
-- y personalización sin rediseñar la base de datos en el futuro.
--
-- Diseño: tabla de eventos genérica con campo JSONB para propiedades
-- específicas de cada tipo de evento. Optimizada para escritura masiva.
--
-- Particionamiento: configurado para particionar por mes cuando el
-- volumen supere 1M de eventos/mes. Las queries no cambian, solo
-- se ejecuta: ALTER TABLE analytics_events PARTITION BY RANGE (created_at)
--
-- Migración a sistema externo: cuando el volumen justifique PostHog,
-- Amplitude o un data warehouse, estos eventos son el insumo.
-- La tabla puede ser leída por scripts ETL sin afectar la aplicación.
-- =============================================================================

CREATE TABLE analytics_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificación del actor
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id      UUID,               -- generado en el cliente, anónimo
    anonymous_id    VARCHAR(255),       -- ID anónimo pre-login (localStorage)

    -- Evento
    event_name      VARCHAR(100) NOT NULL,
    -- Propiedades específicas del evento (ver catálogo abajo)
    properties      JSONB NOT NULL DEFAULT '{}',

    -- Contexto técnico
    device_type     VARCHAR(20)
                    CHECK (device_type IN ('desktop', 'mobile', 'tablet')),
    os              VARCHAR(50),
    browser         VARCHAR(50),
    app_version     VARCHAR(20),

    -- Contexto geográfico (del request, no del usuario)
    ip_country      VARCHAR(2),
    ip_city         VARCHAR(100),

    -- Fuente de tráfico
    utm_source      VARCHAR(100),
    utm_medium      VARCHAR(100),
    utm_campaign    VARCHAR(100),
    referrer        TEXT,

    -- Timestamp (usa created_at para particionamiento futuro)
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Índices para los queries más frecuentes del motor de recomendaciones
CREATE INDEX idx_analytics_user_events
    ON analytics_events(user_id, event_name, created_at DESC)
    WHERE user_id IS NOT NULL;

CREATE INDEX idx_analytics_event_name
    ON analytics_events(event_name, created_at DESC);

CREATE INDEX idx_analytics_session
    ON analytics_events(session_id, created_at ASC)
    WHERE session_id IS NOT NULL;

-- Índice parcial para los eventos de mayor valor para ML
CREATE INDEX idx_analytics_booking_funnel
    ON analytics_events USING GIN(properties)
    WHERE event_name IN (
        'property_viewed',
        'reservation_requested',
        'reservation_completed',
        'property_favorited'
    );

-- =============================================================================
-- CATÁLOGO DE EVENTOS DE ANALYTICS
-- (comentario de referencia, no una tabla — implementado en código)
--
-- EXPLORACIÓN:
--   search_performed
--     properties: {query, city, check_in, check_out, guests, price_min,
--                  price_max, amenities[], results_count, search_id}
--
--   search_result_clicked
--     properties: {property_id, search_rank, search_id, position_on_page}
--
--   map_interaction
--     properties: {action: 'zoom'|'pan'|'click', zoom_level,
--                  center_lat, center_lng, visible_properties_count}
--
--   property_viewed
--     properties: {property_id, host_id, price_per_night, property_type,
--                  source: 'search'|'map'|'direct'|'recommendation',
--                  search_rank, time_on_page_seconds}
--
--   property_photo_viewed
--     properties: {property_id, photo_index, total_photos}
--
--   property_favorited
--     properties: {property_id}
--
--   property_unfavorited
--     properties: {property_id}
--
--   property_shared
--     properties: {property_id, channel: 'whatsapp'|'link'|'other'}
--
-- EMBUDO DE RESERVA:
--   booking_initiated
--     properties: {property_id, check_in, check_out, guests_count,
--                  total_amount, currency}
--
--   reservation_requested
--     properties: {reservation_id, property_id, total_amount}
--
--   reservation_abandoned
--     properties: {property_id, stage: 'dates'|'guests'|'payment'|'confirm',
--                  reason: 'price'|'dates_unavailable'|'navigation'|'unknown'}
--
--   reservation_completed
--     properties: {reservation_id, property_id, total_amount, nights,
--                  property_type, payment_method}
--
-- ENGAGEMENT:
--   message_sent
--     properties: {conversation_id, is_pre_booking, message_length_chars}
--
--   review_written
--     properties: {reservation_id, review_type, overall_rating}
--
--   host_profile_viewed
--     properties: {host_id, from_property_id}
--
-- SESIÓN:
--   session_started
--     properties: {landing_page, device_type, is_returning_user}
--
--   session_ended
--     properties: {duration_seconds, pages_viewed, events_count}
-- =============================================================================


-- Tabla de propiedades favoritas (señal explícita para recomendaciones)
CREATE TABLE property_favorites (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, property_id)
);

CREATE INDEX idx_favorites_user     ON property_favorites(user_id, created_at DESC);
CREATE INDEX idx_favorites_property ON property_favorites(property_id);


-- =============================================================================
-- DATOS INICIALES: CATÁLOGO DE AMENIDADES
-- =============================================================================

INSERT INTO amenities (slug, name_es, name_en, icon, category, is_highlight, sort_order)
VALUES
-- Básicos (aparecen primero, son los más buscados)
('wifi',                'WiFi',                     'WiFi',               'Wifi',         'basicos', TRUE, 1),
('aire_acondicionado',  'Aire acondicionado',        'Air conditioning',   'Wind',         'basicos', TRUE, 2),
('estacionamiento',     'Estacionamiento gratuito',  'Free parking',       'Car',          'basicos', TRUE, 3),
('alberca',             'Alberca',                   'Pool',               'Waves',        'basicos', TRUE, 4),
('televisor',           'Televisor',                 'TV',                 'Tv',           'basicos', TRUE, 5),
('lavadora',            'Lavadora',                  'Washing machine',    'Shirt',        'basicos', FALSE, 6),
('secadora',            'Secadora',                  'Dryer',              'Wind',         'basicos', FALSE, 7),

-- Cocina
('cocina_equipada',     'Cocina equipada',           'Full kitchen',       'ChefHat',      'cocina', TRUE, 10),
('microondas',          'Microondas',                'Microwave',          'Zap',          'cocina', FALSE, 11),
('cafetera',            'Cafetera',                  'Coffee maker',       'Coffee',       'cocina', FALSE, 12),
('refrigerador',        'Refrigerador',              'Refrigerator',       'Thermometer',  'cocina', FALSE, 13),
('utensilios',          'Utensilios de cocina',      'Cooking utensils',   'UtensilsCrossed','cocina', FALSE, 14),

-- Baño
('toallas',             'Toallas',                   'Towels',             'Layers',       'bano', FALSE, 20),
('secador_pelo',        'Secador de pelo',            'Hair dryer',         'Wind',         'bano', FALSE, 21),
('articulos_bano',      'Artículos de baño',          'Toiletries',         'Droplets',     'bano', FALSE, 22),

-- Dormitorio
('ropa_cama',           'Ropa de cama',               'Bed linen',          'Bed',          'dormitorio', FALSE, 30),
('closet',              'Closet o armario',            'Closet',             'LayoutGrid',   'dormitorio', FALSE, 31),
('cuna',                'Cuna disponible',             'Crib available',     'Baby',         'dormitorio', FALSE, 32),

-- Exterior
('terraza',             'Terraza o patio',             'Terrace or patio',   'TreePine',     'exterior', FALSE, 40),
('jardín',              'Jardín',                      'Garden',             'Flower',       'exterior', FALSE, 41),
('asador',              'Asador / BBQ',                'BBQ grill',          'Flame',        'exterior', FALSE, 42),
('hamaca',              'Hamaca',                      'Hammock',            'Moon',         'exterior', FALSE, 43),

-- Seguridad
('caja_seguridad',      'Caja de seguridad',           'Safe box',           'Lock',         'seguridad', FALSE, 50),
('extinguidor',         'Extinguidor',                 'Fire extinguisher',  'Flame',        'seguridad', FALSE, 51),
('detector_humo',       'Detector de humo',            'Smoke detector',     'AlertTriangle','seguridad', FALSE, 52),
('botiquin',            'Botiquín de primeros auxilios','First aid kit',     'HeartPulse',   'seguridad', FALSE, 53),
('camara_exterior',     'Cámaras exteriores',          'Exterior cameras',   'Camera',       'seguridad', FALSE, 54),

-- Entretenimiento
('netflix',             'Netflix / Streaming',          'Netflix / Streaming','Play',        'entretenimiento', FALSE, 60),
('mesa_trabajo',        'Área de trabajo',              'Workspace',          'Monitor',      'entretenimiento', FALSE, 61),

-- Accesibilidad
('acceso_silla_ruedas', 'Acceso para silla de ruedas', 'Wheelchair access',  'Accessibility','accesibilidad', FALSE, 70),
('sin_escaleras',       'Sin escaleras',                'No stairs',          'ArrowDown',    'accesibilidad', FALSE, 71),

-- Servicios
('desayuno',            'Desayuno incluido',            'Breakfast included', 'Coffee',       'servicios', FALSE, 80),
('servicio_limpieza',   'Servicio de limpieza',         'Cleaning service',   'Sparkles',     'servicios', FALSE, 81),
('recepcion_24h',       'Recepción 24 horas',           '24h check-in',       'Clock',        'servicios', FALSE, 82);


-- =============================================================================
-- VISTAS ÚTILES PARA QUERIES FRECUENTES
-- =============================================================================

-- Vista: propiedades activas con datos completos para listado
CREATE VIEW v_active_properties AS
SELECT
    p.id,
    p.title,
    p.property_type,
    p.neighborhood,
    p.city,
    p.state,
    p.latitude_approx   AS latitude,
    p.longitude_approx  AS longitude,
    p.price_per_night,
    p.cleaning_fee,
    p.currency,
    p.max_guests,
    p.bedrooms,
    p.beds,
    p.bathrooms,
    p.avg_rating,
    p.total_reviews,
    p.total_bookings,
    p.ranking_score,
    p.allows_pets,
    p.instant_booking,
    p.cancellation_policy,
    -- Foto principal
    (SELECT url FROM property_photos
     WHERE property_id = p.id AND is_primary = TRUE
     LIMIT 1) AS primary_photo_url,
    (SELECT thumbnail_url FROM property_photos
     WHERE property_id = p.id AND is_primary = TRUE
     LIMIT 1) AS primary_photo_thumbnail,
    -- Host info
    u.id            AS host_id,
    u.full_name     AS host_name,
    u.avatar_url    AS host_avatar,
    u.is_identity_verified AS host_verified,
    u.host_since,
    p.created_at,
    p.updated_at
FROM properties p
JOIN users u ON u.id = p.host_id
WHERE p.status = 'active'
  AND p.deleted_at IS NULL
  AND u.is_active = TRUE
  AND u.deleted_at IS NULL;


-- Vista: reservas activas con datos completos (dashboard)
CREATE VIEW v_reservations_dashboard AS
SELECT
    r.id,
    r.status,
    r.payment_status,
    r.check_in,
    r.check_out,
    r.nights,
    r.guests_count,
    r.total_amount,
    r.currency,
    r.created_at,
    -- Propiedad
    p.id            AS property_id,
    p.title         AS property_title,
    p.city          AS property_city,
    (SELECT url FROM property_photos
     WHERE property_id = p.id AND is_primary = TRUE
     LIMIT 1) AS property_photo,
    -- Huésped
    g.id            AS guest_id,
    g.full_name     AS guest_name,
    g.avatar_url    AS guest_avatar,
    g.is_identity_verified AS guest_verified,
    -- Anfitrión
    h.id            AS host_id,
    h.full_name     AS host_name,
    h.avatar_url    AS host_avatar
FROM reservations r
JOIN properties p   ON p.id = r.property_id
JOIN users g        ON g.id = r.guest_id
JOIN users h        ON h.id = r.host_id
WHERE r.status NOT IN ('cancelled_guest', 'cancelled_host', 'cancelled_admin');


-- =============================================================================
-- FIN DEL SCHEMA
-- =============================================================================
