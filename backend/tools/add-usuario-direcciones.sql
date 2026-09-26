-- Permite asociar varias direcciones a un usuario (una marcada como
-- principal), con la misma división política usada en fincas
-- (país/provincia/distrito/corregimiento como texto libre, sin catálogo
-- propio) y un enlace de Google Maps para geolocalizarla.
CREATE TABLE IF NOT EXISTS public.usuario_direcciones (
  id SERIAL PRIMARY KEY,
  id_usuario BIGINT NOT NULL REFERENCES public.usuarios("idUsuario") ON DELETE CASCADE,
  pais VARCHAR(100),
  provincia VARCHAR(100),
  distrito VARCHAR(100),
  corregimiento VARCHAR(100),
  direccion_texto TEXT,
  es_principal BOOLEAN NOT NULL DEFAULT false,
  google_maps_url TEXT,
  comparte_ubicacion BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuario_direcciones_usuario ON public.usuario_direcciones(id_usuario);
