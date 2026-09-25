-- Agrega los campos de perfil personal editables desde "Mi Perfil"
-- (dirección, ocupación, fecha de nacimiento, tipo de sangre).
-- Idempotente: se puede correr más de una vez sin error.

ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS direccion VARCHAR(255);
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS ocupacion VARCHAR(150);
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS tipo_sangre VARCHAR(5);
