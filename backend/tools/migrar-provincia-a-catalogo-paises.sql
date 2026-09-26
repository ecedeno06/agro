-- =============================================================
-- Reconcilia el nuevo catálogo de provincia/distrito (importado desde
-- catalogo-geografico.sql, que trae su propia tabla "pais") con la tabla
-- ya existente public.catalogo_paises (usada por el CRUD admin de Países
-- y por fincas.controller.js), en lugar de mantener dos catálogos de
-- países en paralelo.
--
-- Pasos:
--   1) Inserta en catalogo_paises los países del script que no existían
--      (territorios/microestados no cubiertos originalmente).
--   2) Remapea provincia.pais_id de "pais.id" (script) a "catalogo_paises.id".
--   3) Reapunta la FK de provincia hacia catalogo_paises y elimina "pais".
-- =============================================================

BEGIN;

INSERT INTO catalogo_paises (nombre, codigo_iso2, codigo_iso3, nacionalidad, moneda, activo)
SELECT p.nombre, p.codigo_iso2, p.codigo_iso3, '', p.moneda, true
FROM pais p
WHERE NOT EXISTS (
  SELECT 1 FROM catalogo_paises cp WHERE cp.codigo_iso2 = p.codigo_iso2
);

ALTER TABLE provincia ADD COLUMN pais_id_nuevo INTEGER;

UPDATE provincia pr
SET pais_id_nuevo = cp.id
FROM pais p
JOIN catalogo_paises cp ON cp.codigo_iso2 = p.codigo_iso2
WHERE pr.pais_id = p.id;

ALTER TABLE provincia DROP CONSTRAINT fk_provincia_pais;
ALTER TABLE provincia DROP COLUMN pais_id;
ALTER TABLE provincia RENAME COLUMN pais_id_nuevo TO pais_id;
ALTER TABLE provincia ALTER COLUMN pais_id SET NOT NULL;
ALTER TABLE provincia ADD CONSTRAINT fk_provincia_pais
  FOREIGN KEY (pais_id) REFERENCES catalogo_paises(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX ix_provincia_pais ON provincia(pais_id);

DROP TABLE pais;

COMMIT;
