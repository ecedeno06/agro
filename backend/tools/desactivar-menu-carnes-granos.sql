-- Los submenús "Carnes" (id 8) y "Granos" (id 9) bajo "Productos" (id 7)
-- quedaron obsoletos: el CRUD de Productos ahora maneja las 12 categorías
-- (Carnes, Granos, Lácteos, etc.) desde el propio tab "Categorías", por lo
-- que tener solo 2 accesos directos hardcodeados en el sidebar ya no encaja.
-- "Productos" pasa a ser un enlace directo (sin submenú).
UPDATE public.menus SET estado = false WHERE id IN (8, 9);
