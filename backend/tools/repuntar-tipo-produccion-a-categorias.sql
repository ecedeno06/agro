-- "Tipo de Producción" en Mis Fincas usaba un catálogo independiente
-- (tipo_produccion, con solo 6 valores fijos: Carnes, Granos, Frutas y
-- Hortalizas, Cultivos Industriales, Lacteos, Forestal), distinto del
-- catálogo real de Productos (categorias: Carnes, Granos, Lácteos, Aves y
-- Huevos, Frutas, Verduras, Tubérculos y Raíces, Legumbres, Productos del
-- Mar, Semillas, Insumos Agrícolas, Forraje y Alimento Animal). Se repunta
-- la FK para que el selector salga del catálogo real de Productos.

-- 1) Migrar el único dato real existente (Cerro Silvestre -> "Granos"),
--    haciendo match por NOMBRE antes de romper la referencia vieja.
UPDATE public.fincas f
SET id_tipo_produccion = c.id
FROM public.tipo_produccion tp
JOIN public.categorias c ON c.nombre = tp.nombre AND c.categoria_padre_id IS NOT NULL
WHERE f.id_tipo_produccion = tp.id_tipo;

-- 2) Repuntar la FK de tipo_produccion(id_tipo) a categorias(id).
ALTER TABLE public.fincas DROP CONSTRAINT fincas_id_tipo_produccion_fkey;
ALTER TABLE public.fincas
  ADD CONSTRAINT fincas_id_tipo_produccion_fkey
  FOREIGN KEY (id_tipo_produccion) REFERENCES public.categorias(id);

-- Nota: la tabla tipo_produccion y su CRUD (backend/src/controllers/tipo-produccion.controller.js)
-- quedan sin usar pero no se eliminan en esta migración.
