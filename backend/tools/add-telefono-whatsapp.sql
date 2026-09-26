-- Indica si el teléfono del usuario recibe mensajes de WhatsApp.
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS telefono_whatsapp BOOLEAN NOT NULL DEFAULT false;
