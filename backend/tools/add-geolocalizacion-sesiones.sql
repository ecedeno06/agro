-- Captura de IP y geolocalización aproximada (por IP, sin pedir permiso al
-- usuario) en cada sesión, para mostrarlas en Auditoría de Sesiones.
ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64),
  ADD COLUMN IF NOT EXISTS geo_pais VARCHAR(100),
  ADD COLUMN IF NOT EXISTS geo_region VARCHAR(100),
  ADD COLUMN IF NOT EXISTS geo_ciudad VARCHAR(100);
