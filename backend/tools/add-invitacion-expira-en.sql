-- Soporta la invitación por correo (link + usuario + password temporal
-- válida por 1 hora): si debe_cambiar_password=true y esta fecha ya pasó,
-- el login rechaza la contraseña temporal (ver auth.controller.js login()).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS invitacion_expira_en TIMESTAMPTZ;
