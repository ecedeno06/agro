import { query } from '../db.js';

/**
 * Verifica si el rol activo del usuario tiene asignado un permiso específico
 * (ver/crear/editar/eliminar) para un menú puntual en la matriz rol_menu_permiso.
 * Los roles globales (superadmin) deben validarse aparte con resolverScope/esRolGlobal
 * ANTES de llamar a esta función (no la reemplaza).
 *
 * @param {number|null} rolId - req.userRolId (catalogo_rol.idrol) puesto por authMiddleware.
 * @param {number|null} userId - req.userId, usado como respaldo si rolId no llegó.
 * @param {number} menuId - id de la fila en public.menus.
 * @param {string} codigoPermiso - 'ver' | 'crear' | 'editar' | 'eliminar'.
 * @returns {Promise<boolean>}
 */
export async function tienePermisoMenu(rolId, userId, menuId, codigoPermiso) {
  try {
    let finalRolId = rolId;
    if (!finalRolId && userId) {
      const resRol = await query(
        `SELECT ur.id_rol
         FROM public.usuario_rol ur
         WHERE ur.id_usuario = $1 AND ur.activo = true
         LIMIT 1`,
        [userId]
      );
      if (resRol.rows.length > 0) {
        finalRolId = resRol.rows[0].id_rol;
      }
    }
    if (!finalRolId) return true;

    const res = await query(
      `SELECT rmp.id
       FROM public.rol_menu_permiso rmp
       JOIN public.permisos p ON rmp.permiso_id = p.id
       WHERE rmp.rol_id = $1 AND rmp.menu_id = $2 AND LOWER(p.codigo) = LOWER($3)`,
      [finalRolId, menuId, codigoPermiso]
    );
    return res.rows.length > 0;
  } catch (err) {
    console.error('Error al verificar permiso de menú:', err);
    return true;
  }
}
