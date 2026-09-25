/**
 * Geolocalización aproximada por IP (país/región/ciudad), sin pedirle
 * permiso al usuario -- a diferencia del GPS del navegador (usado en
 * Mis Fincas), esto se resuelve enteramente en el servidor a partir de la
 * IP de origen de la petición, usando el servicio gratuito ip-api.com.
 * Es aproximada (nivel ciudad), nunca tan precisa como un GPS real.
 */

const IP_API_URL = 'http://ip-api.com/json';
const TIMEOUT_MS = 3000;

/** Extrae la IP real del cliente a partir de req.ip (requiere `trust proxy`). */
export function obtenerIpCliente(req) {
  const ip = req.ip || req.connection?.remoteAddress || null;
  return ip ? ip.replace('::ffff:', '') : null;
}

function esIpPrivada(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  return false;
}

/**
 * @param {string|null} ip
 * @returns {Promise<{ pais: string|null, region: string|null, ciudad: string|null }>}
 */
export async function obtenerGeoIP(ip) {
  const vacio = { pais: null, region: null, ciudad: null };
  if (esIpPrivada(ip)) return vacio;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(
      `${IP_API_URL}/${encodeURIComponent(ip)}?fields=status,country,regionName,city`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);

    const data = await response.json();
    if (data.status !== 'success') return vacio;

    return {
      pais: data.country || null,
      region: data.regionName || null,
      ciudad: data.city || null
    };
  } catch (error) {
    console.error('Error al geolocalizar IP:', error.message);
    return vacio;
  }
}
