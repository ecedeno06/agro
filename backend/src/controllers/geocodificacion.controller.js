// Proxy hacia la API de Geocoding de Google -- la key (MAPKEY) vive solo
// aquí, nunca se expone al frontend.
const MAPKEY = process.env.MAPKEY;

// address_components.types de Google: administrative_area_level_1 es la
// provincia, administrative_area_level_2 el distrito (a veces con el
// prefijo "Distrito de ", que se normaliza). El corregimiento no llega en
// las pruebas hechas para Panamá, así que queda para entrada manual.
// El short_name del componente "country" es el código ISO 3166-1 alpha-2
// (ej. "PA"), que es justo lo que usa public.catalogo_paises.codigo_iso2.
function mapearComponentes(components) {
  const buscar = (tipo) => components.find((c) => c.types.includes(tipo));

  const paisComp = buscar('country');
  const provinciaComp = buscar('administrative_area_level_1');
  const distritoComp = buscar('administrative_area_level_2');

  const provinciaNombre = provinciaComp?.long_name || null;
  const distritoNombre = distritoComp?.long_name || null;

  return {
    pais_codigo: paisComp?.short_name || null,
    pais_nombre: paisComp?.long_name || null,
    provincia: provinciaNombre ? provinciaNombre.replace(/^Provincia de /i, '') : null,
    distrito: distritoNombre ? distritoNombre.replace(/^Distrito de /i, '') : null
  };
}

// GET /api/geocodificacion/reverse?lat=&lng=
export const reverseGeocode = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ message: 'lat y lng son requeridos' });
    }
    if (!MAPKEY) {
      return res.status(500).json({ message: 'Geocodificación no configurada en el servidor' });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&key=${MAPKEY}&language=es&region=pa`;
    const resp = await fetch(url);
    const data = await resp.json();

    if (data.status !== 'OK' || !data.results?.[0]) {
      return res.status(404).json({ message: 'No se pudo determinar la división política para ese punto.' });
    }

    return res.status(200).json(mapearComponentes(data.results[0].address_components));
  } catch (error) {
    next(error);
  }
};
