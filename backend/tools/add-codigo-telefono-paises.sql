-- =============================================================
-- Agrega codigo_telefono (código de marcación, ej. Panamá = 507) a
-- catalogo_paises, respaldado desde catalogo-geografico.sql (la tabla
-- "pais" original del script traía este dato antes de ser reconciliada
-- con catalogo_paises y eliminada — ver migrar-provincia-a-catalogo-paises.sql).
--
-- YA APLICADO. Este archivo documenta cómo se hizo (se ejecutó extrayendo
-- el bloque CREATE TABLE pais + su INSERT de catalogo-geografico.sql hacia
-- una tabla temporal "pais_temp_codigos" para poder cruzar por codigo_iso2
-- sin tocar las tablas provincia/distrito reales).
-- =============================================================

ALTER TABLE catalogo_paises ADD COLUMN IF NOT EXISTS codigo_telefono VARCHAR(20);

-- UPDATE catalogo_paises cp
-- SET codigo_telefono = pt.codigo_telefono
-- FROM pais_temp_codigos pt
-- WHERE pt.codigo_iso2 = cp.codigo_iso2;
