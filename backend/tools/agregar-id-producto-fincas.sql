-- "Sub Categoria" en Editar Finca: el producto específico (catalogo_productos)
-- dentro de la categoría elegida en "Tipo de Producción" (categorias).
ALTER TABLE public.fincas
  ADD COLUMN id_producto INTEGER REFERENCES public.catalogo_productos(id) ON DELETE SET NULL;
