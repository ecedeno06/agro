-- ═══════════════════════════════════════════════════════════════
-- Migración Fase 2 — permitir el mismo rol en capítulos distintos
--
-- Bug: uq_usuario_rol se creó como UNIQUE (id_usuario, id_rol) en
-- migration-superuser-identity.sql / migration-fase1-multisuperadmin.sql,
-- únicamente para poder anclar el FK compuesto de
-- security.superuser_identity. Efecto secundario no deseado: la base de
-- datos rechaza asignar el MISMO código de rol (ej. 'ASO') a un usuario
-- en un capítulo diferente, con:
--   duplicate key value violates unique constraint "uq_usuario_rol"
--
-- Esta migración:
--   1. Quita el FK compuesto que dependía del unique antiguo.
--   2. Sustituye uq_usuario_rol por un unique que SÍ incluye
--      id_capitulo, para que la combinación única real sea
--      (usuario, rol, capítulo) y no (usuario, rol).
--   3. Repone un FK simple (solo id_usuario) para conservar la
--      integridad referencial de security.superuser_identity sin
--      volver a acoplarla a una tupla (usuario, rol) concreta.
--
-- Idempotente — se puede correr más de una vez sin error.
-- Ejecutar manualmente contra la base (Supabase SQL editor o psql).
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- 0. Diagnóstico: si esto devuelve filas, hay que resolverlas a mano
--    antes de continuar (no debería, la restricción vieja lo impedía).
--    SELECT id_usuario, id_rol, id_capitulo, COUNT(*)
--    FROM public.usuario_rol
--    GROUP BY id_usuario, id_rol, id_capitulo HAVING COUNT(*) > 1;

-- 1. Quitar el FK compuesto de superuser_identity (dependía de uq_usuario_rol).
ALTER TABLE security.superuser_identity
  DROP CONSTRAINT IF EXISTS fk_superuser_usuario_rol;

-- 2. Quitar el unique demasiado restrictivo.
ALTER TABLE public.usuario_rol
  DROP CONSTRAINT IF EXISTS uq_usuario_rol;

-- 3. Unique correcto: mismo rol permitido en capítulos distintos, pero
--    no duplicado dentro del mismo capítulo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_usuario_rol_capitulo'
  ) THEN
    ALTER TABLE public.usuario_rol
    ADD CONSTRAINT uq_usuario_rol_capitulo UNIQUE (id_usuario, id_rol, id_capitulo);
  END IF;
END $$;

-- 4. FK de reemplazo: solo valida que el usuario exista. El superadmin
--    es un rol global y no necesita depender de una tupla (usuario, rol).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_superuser_usuario'
  ) THEN
    ALTER TABLE security.superuser_identity
    ADD CONSTRAINT fk_superuser_usuario
      FOREIGN KEY (id_usuario) REFERENCES public.usuarios("idUsuario") ON DELETE RESTRICT;
  END IF;
END $$;

COMMIT;

-- Verificación después de correr esto:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.usuario_rol'::regclass;
