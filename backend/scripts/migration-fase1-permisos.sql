-- ═══════════════════════════════════════════════════════════════
-- Separación de permisos (sección 9 del plan Fase 1)
--
-- Crea una cuenta de PostgreSQL dedicada al aprovisionamiento de
-- SUPERADMIN, dueña del esquema `security`, y restringe a la cuenta
-- normal del backend (la que usa DB_USER en tu .env) a solo lectura
-- sobre security.superuser_identity.
--
-- EJECUTAR MANUALMENTE Y REVISANDO CADA PASO (Supabase SQL editor
-- o psql), con un rol que tenga privilegios suficientes para crear
-- roles (normalmente el rol "postgres" por defecto de Supabase).
--
-- Antes de correr esto, sustituye:
--   - 'CAMBIAR_ESTA_CONTRASEÑA'  → una contraseña real y segura
--   - <ROL_APP_ACTUAL>           → el valor de DB_USER en tu .env
--     (si tiene puntos, va entre comillas dobles, ej: "postgres.abc123xyz")
-- ═══════════════════════════════════════════════════════════════

-- 1. Crear la cuenta administrativa.
CREATE ROLE security_provisioner
LOGIN PASSWORD 'CAMBIAR_ESTA_CONTRASEÑA';

-- 2. Transferir la propiedad del esquema y tablas de seguridad.
--    (El dueño de una tabla conserva todos los privilegios sin
--    importar cuántos REVOKE se le apliquen desde otro lado, así
--    que este paso es el que de verdad importa, no los GRANT/REVOKE.)
ALTER SCHEMA security OWNER TO security_provisioner;
ALTER TABLE security.superuser_identity OWNER TO security_provisioner;
ALTER TABLE security.auditoria_seguridad OWNER TO security_provisioner;

-- Verificar quién quedó como dueño antes de continuar:
-- SELECT tablename, tableowner FROM pg_tables WHERE schemaname = 'security';

-- 3. Permisos mínimos para security_provisioner.
GRANT USAGE
ON SCHEMA security
TO security_provisioner;

GRANT SELECT, INSERT, UPDATE, DELETE
ON security.superuser_identity
TO security_provisioner;

GRANT SELECT, INSERT
ON security.auditoria_seguridad
TO security_provisioner;

GRANT SELECT
ON usuarios, catalogo_rol, usuario_rol
TO security_provisioner;

GRANT INSERT
ON usuario_rol
TO security_provisioner;

-- 4. Restringir la cuenta normal del backend.
REVOKE ALL
ON security.superuser_identity
FROM PUBLIC;

GRANT USAGE
ON SCHEMA security
TO <ROL_APP_ACTUAL>;

GRANT SELECT
ON security.superuser_identity
TO <ROL_APP_ACTUAL>;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE
ON security.superuser_identity
FROM <ROL_APP_ACTUAL>;

-- Este REVOKE solo tiene efecto real si <ROL_APP_ACTUAL> no quedó
-- como dueño de la tabla (paso 2). Confírmalo con la consulta de
-- arriba, y de paso prueba un INSERT de prueba que deba fallar:
--   INSERT INTO security.superuser_identity (id_usuario, id_rol, security_id, firma, version_firma)
--   VALUES (999999, 1, gen_random_uuid(), '\x00', 1);
-- (debe fallar con "permission denied", conectado como <ROL_APP_ACTUAL>)

-- 5. Una vez creado security_provisioner, agrega a tu .env
--    (NUNCA subir la contraseña real a git):
--
--    SECURITY_DATABASE_URL=postgresql://security_provisioner:LA_CONTRASEÑA_REAL@<mismo host/puerto>/<mismo db>
--
-- scripts/provision-superuser.js ya usa SECURITY_DATABASE_URL si está
-- presente, y solo cae de vuelta a las variables DB_* normales si no
-- lo está (ver el script — es intencional para que sigas pudiendo
-- provisionar antes de aplicar esta separación de permisos).
