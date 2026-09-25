-- Las columnas id_privincia/id_distrito de fincas nunca tuvieron un catálogo
-- propio (eran solo un ID numérico libre, ver "Provincia (ID)" en el
-- formulario). Ahora se llenan por geocodificación inversa (Google Geocoding
-- API), que devuelve NOMBRES, no IDs, así que se cambian a texto.
ALTER TABLE public.fincas
  ALTER COLUMN id_privincia TYPE TEXT USING id_privincia::TEXT;

ALTER TABLE public.fincas
  ALTER COLUMN id_distrito TYPE TEXT USING id_distrito::TEXT;
