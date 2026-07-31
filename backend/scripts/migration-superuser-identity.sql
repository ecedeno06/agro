-- ═══════════════════════════════════════════════════════════════
-- Migración: Identidad firmada para SUPERADMIN
-- Ejecutar manualmente contra la base de datos 'agroAzuero'
-- ═══════════════════════════════════════════════════════════════

-- PASO 0: Actualizar el rol 1 como SUPERADMIN
UPDATE public.catalogo_rol 
SET codigo = 'SUPERADMIN', descripcion = 'Super Administrador'
WHERE idrol = 1;

-- PASO 1: Crear esquema de seguridad
CREATE SCHEMA IF NOT EXISTS security;

-- PASO 2: Restricción única en usuario_rol (prevenir duplicados)
-- Diagnóstico previo (ejecutar primero para verificar):
-- SELECT id_usuario, id_rol, COUNT(*) 
-- FROM public.usuario_rol 
-- GROUP BY id_usuario, id_rol HAVING COUNT(*) > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_usuario_rol'
  ) THEN
    ALTER TABLE public.usuario_rol
    ADD CONSTRAINT uq_usuario_rol UNIQUE (id_usuario, id_rol);
  END IF;
END $$;

-- PASO 3: Tabla de identidad firmada
-- slot = 1 con CHECK garantiza UN SOLO superadmin firmado
CREATE TABLE IF NOT EXISTS security.superuser_identity (
    slot            SMALLINT PRIMARY KEY DEFAULT 1 CHECK (slot = 1),
    id_usuario      BIGINT NOT NULL,
    id_rol          BIGINT NOT NULL DEFAULT 1,
    security_id     UUID NOT NULL UNIQUE,
    firma           BYTEA NOT NULL,
    version_firma   SMALLINT NOT NULL DEFAULT 1,
    ambiente        VARCHAR(30) NOT NULL DEFAULT 'production',
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_superuser_usuario_rol
        FOREIGN KEY (id_usuario, id_rol)
        REFERENCES public.usuario_rol(id_usuario, id_rol)
        ON DELETE RESTRICT
);

-- PASO 4: Tabla de auditoría de seguridad
CREATE TABLE IF NOT EXISTS security.auditoria_seguridad (
    id              BIGSERIAL PRIMARY KEY,
    id_usuario      BIGINT,
    evento          VARCHAR(100) NOT NULL,
    descripcion     TEXT,
    ip              INET,
    user_agent      TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- Verificación: ejecutar después de la migración
-- ═══════════════════════════════════════════════════════════════
-- SELECT codigo, descripcion FROM public.catalogo_rol WHERE idrol = 1;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'security';
