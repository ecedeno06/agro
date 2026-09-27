-- El formulario de Productos pasó de un input de texto "URL de Imagen" a
-- subir/tomar/pegar una foto real (mismo patrón del avatar de usuario),
-- que se guarda como data URL base64. VARCHAR(500) se quedaba corto
-- ("value too long for type character varying(500)") incluso para fotos
-- pequeñas (redimensionadas a 300px, ~10-40KB en base64).
ALTER TABLE public.catalogo_productos ALTER COLUMN imagen_url TYPE TEXT;
