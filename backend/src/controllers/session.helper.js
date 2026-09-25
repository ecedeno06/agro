import crypto from 'crypto';
import { query } from '../db.js';
import { obtenerGeoIP } from '../helpers/geoip.helper.js';

const SESSION_DURATION_HOURS = Number(process.env.SESSION_DURATION_HOURS) || 8;

/**
 * Crea una sesión en la base de datos y retorna el token generado.
 * @param {number|string} idUsuario
 * @param {string|null} rolCodigo - El código del rol seleccionado para la sesión activa
 * @param {number|null} idCapitulo - Capítulo del rol activo. Se persiste para poder acotar
 *                                   los datos que ve un rol no global en cada petición.
 * @param {string|null} ipAddress - IP de origen de la petición de login (ver obtenerIpCliente).
 *                                  La geolocalización (país/región/ciudad) se resuelve a
 *                                  partir de ella, sin pedirle permiso al usuario.
 * @returns {Promise<{ token: string, expiresIn: number }>}
 */
export async function createSession(idUsuario, rolCodigo = null, idCapitulo = null, ipAddress = null) {
  const token = 'sess_' + crypto.randomBytes(24).toString('hex');

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS);

  const geo = await obtenerGeoIP(ipAddress);

  await query(
    `INSERT INTO public.sesiones
       (token, id_usuario, rol_codigo, id_capitulo, expira_en, ip_address, geo_pais, geo_region, geo_ciudad)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [token, idUsuario, rolCodigo, idCapitulo ?? null, expiresAt.toISOString(), ipAddress, geo.pais, geo.region, geo.ciudad]
  );

  // expiresIn en milisegundos
  const expiresIn = SESSION_DURATION_HOURS * 60 * 60 * 1000;

  return { token, expiresIn };
}

export { SESSION_DURATION_HOURS };
