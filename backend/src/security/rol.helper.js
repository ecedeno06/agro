import { query } from '../db.js';

/**
 * Resolución centralizada de roles contra catalogo_rol.
 *
 * La columna heredada `usuarios.rol` es texto libre y quedó desincronizada del
 * catálogo real ('admin' vs 'adm', 'secretaria' vs 'sec', etc.). La fuente de
 * verdad es catalogo_rol + usuario_rol; este helper traduce cualquier entrada
 * legacy al idrol correcto y evita repetir mapeos difusos en los controladores.
 */

/** Alias históricos -> código real en catalogo_rol. */
const ALIAS_ROLES = {
  admin: 'adm',
  administrador: 'adm',
  secretaria: 'sec',
  asociado: 'aso',
  productor: 'aso'
};

/**
 * Normaliza un código de rol aplicando los alias legacy.
 * @param {string|null|undefined} codigo
 * @returns {string|null}
 */
export function normalizarCodigoRol(codigo) {
  if (!codigo) return null;
  const limpio = String(codigo).trim().toLowerCase();
  if (!limpio) return null;
  return ALIAS_ROLES[limpio] || limpio;
}

/**
 * Resuelve un rol del catálogo a partir de un idRol o de un código (admite alias).
 * @param {{ idRol?: number|string|null, codigo?: string|null }} entrada
 * @param {(text: string, params?: any[]) => Promise<import('pg').QueryResult>} [ejecutor]
 * @returns {Promise<{ idrol: number, codigo: string, descripcion: string }|null>}
 */
export async function resolverRol({ idRol = null, codigo = null }, ejecutor = query) {
  if (idRol != null && !Number.isNaN(Number(idRol))) {
    const porId = await ejecutor(
      'SELECT idrol, codigo, descripcion FROM public.catalogo_rol WHERE idrol = $1 AND activo = true',
      [Number(idRol)]
    );
    if (porId.rows.length > 0) return porId.rows[0];
    return null;
  }

  const codigoNormalizado = normalizarCodigoRol(codigo);
  if (!codigoNormalizado) return null;

  const porCodigo = await ejecutor(
    'SELECT idrol, codigo, descripcion FROM public.catalogo_rol WHERE LOWER(codigo) = $1 AND activo = true LIMIT 1',
    [codigoNormalizado]
  );
  return porCodigo.rows.length > 0 ? porCodigo.rows[0] : null;
}
