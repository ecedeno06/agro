-- La columna menus.icono era VARCHAR(50) (pensada solo para un emoji o una
-- ruta corta tipo /assets/icons/x.png). Para poder guardar íconos subidos
-- como imagen en base64 (data URI), hace falta un tipo sin límite de
-- longitud práctico.
ALTER TABLE public.menus ALTER COLUMN icono TYPE TEXT;
