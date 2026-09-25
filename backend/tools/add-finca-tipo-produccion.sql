-- Vincula cada finca a UN tipo de producción del catálogo existente
-- (public.tipo_produccion), para poder filtrar el mapa de fincas por
-- este criterio. Nullable: una finca puede no tener tipo asignado aún.
ALTER TABLE public.fincas
  ADD COLUMN IF NOT EXISTS id_tipo_produccion INT REFERENCES public.tipo_produccion(id_tipo);
