-- ═══════════════════════════════════════════════════════════════
-- Migración Fase 1 — multi-superadmin + revocación suave
--
-- Idempotente: funciona sin importar el estado real de la base:
--   a) security.superuser_identity no existe todavía  → la crea
--      directamente en su forma final (con activo, sin slot).
--   b) existe en su forma antigua (slot = 1)           → la
--      actualiza en sitio, sin perder la fila ya provisionada.
--   c) ya está en su forma final (ya migrada)          → no hace nada.
--
-- No re-firma ninguna identidad: el formato del payload firmado
-- (superuser-payload.js) no cambia, así que cualquier firma Ed25519
-- ya guardada sigue verificando después de esta migración.
--
-- Ejecutar manualmente contra la base de datos (Supabase SQL editor
-- o psql). Va dentro de una transacción: si algo falla, no queda
-- nada a medias.
-- ═══════════════════════════════════════════════════════════════

-- Diagnóstico previo opcional — ver si la tabla ya existe y cómo:
-- SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'security';
-- SELECT column_name FROM information_schema.columns WHERE table_schema = 'security' AND table_name = 'superuser_identity';

BEGIN;

CREATE SCHEMA IF NOT EXISTS security;

-- 0. Restricción única en usuario_rol, requerida por el FK de abajo.
--    Si esto falla con "no se pudo crear la restricción única", primero
--    revisa y corrige duplicados:
--      SELECT id_usuario, id_rol, COUNT(*) FROM public.usuario_rol
--      GROUP BY id_usuario, id_rol HAVING COUNT(*) > 1;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_usuario_rol'
  ) THEN
    ALTER TABLE public.usuario_rol
    ADD CONSTRAINT uq_usuario_rol UNIQUE (id_usuario, id_rol);
  END IF;
END $$;

-- 1. Caso a: la tabla no existe todavía → crearla directamente en su
--    forma final (equivalente a haber corrido migration-superuser-identity.sql
--    y esta migración juntas).
CREATE TABLE IF NOT EXISTS security.superuser_identity (
    id              BIGSERIAL PRIMARY KEY,
    id_usuario      BIGINT NOT NULL,
    id_rol          BIGINT NOT NULL DEFAULT 1,
    security_id     UUID NOT NULL UNIQUE,
    firma           BYTEA NOT NULL,
    version_firma   SMALLINT NOT NULL DEFAULT 1,
    ambiente        VARCHAR(30) NOT NULL DEFAULT 'production',
    activo          BOOLEAN NOT NULL DEFAULT true,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_superuser_identity_usuario UNIQUE (id_usuario),
    CONSTRAINT fk_superuser_usuario_rol
        FOREIGN KEY (id_usuario, id_rol)
        REFERENCES public.usuario_rol(id_usuario, id_rol)
        ON DELETE RESTRICT
);

-- 2. Caso b: la tabla ya existía en su forma antigua (slot = 1) →
--    actualizarla en sitio, preservando la fila ya provisionada.
DO $$
DECLARE
  pk_name text;
  check_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'security'
      AND table_name = 'superuser_identity'
      AND column_name = 'slot'
  ) THEN
    -- id como nueva PK sustituta.
    ALTER TABLE security.superuser_identity ADD COLUMN IF NOT EXISTS id BIGSERIAL;

    -- Revocación suave.
    ALTER TABLE security.superuser_identity ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

    -- Quitar la PRIMARY KEY atada a slot y el CHECK(slot = 1).
    SELECT conname INTO pk_name
    FROM pg_constraint
    WHERE conrelid = 'security.superuser_identity'::regclass
      AND contype = 'p';

    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE security.superuser_identity DROP CONSTRAINT %I', pk_name);
    END IF;

    SELECT conname INTO check_name
    FROM pg_constraint
    WHERE conrelid = 'security.superuser_identity'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%slot%';

    IF check_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE security.superuser_identity DROP CONSTRAINT %I', check_name);
    END IF;

    ALTER TABLE security.superuser_identity ADD CONSTRAINT superuser_identity_pkey PRIMARY KEY (id);
    ALTER TABLE security.superuser_identity ADD CONSTRAINT uq_superuser_identity_usuario UNIQUE (id_usuario);
    ALTER TABLE security.superuser_identity DROP COLUMN slot;
  END IF;
END $$;

-- 3. Tabla de auditoría (puede que ya exista; si no, se crea aquí).
CREATE TABLE IF NOT EXISTS security.auditoria_seguridad (
    id              BIGSERIAL PRIMARY KEY,
    id_usuario      BIGINT,
    evento          VARCHAR(100) NOT NULL,
    descripcion     TEXT,
    ip              INET,
    user_agent      TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

-- Verificación después de correr esto:
-- SELECT id, id_usuario, id_rol, activo, ambiente, version_firma
-- FROM security.superuser_identity;
--
-- Si ya habías provisionado un SUPERADMIN antes de este error, su fila
-- debe seguir apareciendo, ahora con activo = true. Si la tabla no
-- existía (como en este caso), la consulta devuelve 0 filas — es
-- normal: todavía no se ha provisionado ningún SUPERADMIN. Corre
-- provision-superuser.js con --bootstrap para crear el primero.
