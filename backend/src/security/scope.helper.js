/**
 * Helper central de alcance (scope) por capítulo.
 *
 * Regla de negocio acordada: SOLO el rol SUPERADMIN es global.
 * Cualquier otro rol -- incluido 'adm' (administrador de capítulo) -- queda
 * restringido a los datos del capítulo con el que inició sesión.
 *
 * Este archivo es la ÚNICA fuente de verdad sobre qué rol es global.
 * No repetir listas de roles hardcodeadas en los controladores.
 */

/** Códigos de rol con acceso global (sin filtro de capítulo). */
export const ROLES_GLOBALES = ['superadmin'];

/**
 * Indica si un código de rol tiene alcance global.
 * @param {string|null|undefined} rolCodigo
 * @returns {boolean}
 */
export function esRolGlobal(rolCodigo) {
  if (!rolCodigo) return false;
  return ROLES_GLOBALES.includes(String(rolCodigo).trim().toLowerCase());
}

/**
 * Resuelve el alcance de la petición actual a partir de lo que dejó authMiddleware.
 * @param {import('express').Request} req
 * @returns {{ esGlobal: boolean, idCapitulo: number|null }}
 */
export function resolverScope(req) {
  const esGlobal = esRolGlobal(req.userRol);
  const idCapitulo = req.userCapituloId != null ? Number(req.userCapituloId) : null;
  return { esGlobal, idCapitulo };
}

/**
 * Verifica que la petición pueda operar sobre un capítulo concreto.
 * Un rol global puede operar sobre cualquiera; el resto solo sobre el suyo.
 * @param {import('express').Request} req
 * @param {number|string|null} idCapituloObjetivo
 * @returns {boolean}
 */
export function puedeAccederCapitulo(req, idCapituloObjetivo) {
  const { esGlobal, idCapitulo } = resolverScope(req);
  if (esGlobal) return true;
  if (idCapitulo == null || idCapituloObjetivo == null) return false;
  return Number(idCapitulo) === Number(idCapituloObjetivo);
}

/**
 * Construye el fragmento SQL y el parámetro para filtrar por capítulo.
 * Devuelve clause vacío cuando el rol es global (no se filtra nada).
 *
 * Uso:
 *   const { clause, params } = filtroCapituloSQL(req, 'ur.id_capitulo', queryParams.length);
 *   if (clause) { queryStr += ` AND ${clause}`; queryParams.push(...params); }
 *
 * @param {import('express').Request} req
 * @param {string} columna - Columna calificada a comparar (ej. 'ur.id_capitulo')
 * @param {number} paramOffset - Cantidad de parámetros ya usados en la query
 * @returns {{ clause: string, params: any[] }}
 */
export function filtroCapituloSQL(req, columna, paramOffset = 0) {
  const { esGlobal, idCapitulo } = resolverScope(req);
  if (esGlobal) return { clause: '', params: [] };

  // Rol no global sin capítulo asignado: no debe ver nada.
  if (idCapitulo == null) return { clause: '1 = 0', params: [] };

  return { clause: `${columna} = $${paramOffset + 1}`, params: [idCapitulo] };
}
