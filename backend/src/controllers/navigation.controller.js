import { query } from '../db.js';
import { resolverScope } from '../security/scope.helper.js';

export const getMenu = async (req, res, next) => {
  try {
    const rolId = req.userRolId;
    const { esGlobal, idCapitulo } = resolverScope(req);

    // Un rol no global (ej. ADM de capítulo) debe tener un capítulo en sesión.
    // Sin él no se puede acotar lo que ve, así que no se entrega menú.
    if (!esGlobal && idCapitulo == null) {
      return res.status(200).json([]);
    }

    const result = await query(
      `SELECT DISTINCT m.id, m.nombre, m.ruta, m.icono, m.padre_id, m.orden
       FROM public.rol_menu_permiso rmp
       JOIN public.menus m ON rmp.menu_id = m.id
       WHERE rmp.rol_id = $1 AND m.estado = true
       ORDER BY m.orden ASC`,
      [rolId]
    );

    const allMenus = result.rows;
    // Filtrar padres e hijos
    const parentMenus = allMenus.filter(m => m.padre_id === null);
    const childMenus = allMenus.filter(m => m.padre_id !== null);

    // Armar jerarquía
    const menuTree = parentMenus.map(parent => {
      const submenu = childMenus
        .filter(child => Number(child.padre_id) === Number(parent.id))
        .sort((a, b) => a.orden - b.orden);
      return {
        id: Number(parent.id),
        nombre: parent.nombre,
        ruta: parent.ruta,
        icono: parent.icono,
        orden: parent.orden,
        submenu: submenu.map(s => ({
          id: Number(s.id),
          nombre: s.nombre,
          ruta: s.ruta,
          icono: s.icono,
          orden: s.orden
        }))
      };
    });

    // Ordenar menú principal por el campo orden
    menuTree.sort((a, b) => a.orden - b.orden);

    return res.status(200).json(menuTree);
  } catch (error) {
    next(error);
  }
};

export const getPermissions = async (req, res, next) => {
  try {
    const rolId = req.userRolId;
    const { esGlobal, idCapitulo } = resolverScope(req);

    // Coherente con getMenu: sin capítulo no hay permisos que entregar.
    if (!esGlobal && idCapitulo == null) {
      return res.status(200).json({});
    }

    const result = await query(
      `SELECT m.ruta, p.codigo 
       FROM public.rol_menu_permiso rmp
       JOIN public.menus m ON rmp.menu_id = m.id
       JOIN public.permisos p ON rmp.permiso_id = p.id
       WHERE rmp.rol_id = $1`,
      [rolId]
    );

    const permissionsMap = {};
    result.rows.forEach(row => {
      if (!permissionsMap[row.ruta]) {
        permissionsMap[row.ruta] = [];
      }
      permissionsMap[row.ruta].push(row.codigo);
    });

    return res.status(200).json(permissionsMap);
  } catch (error) {
    next(error);
  }
};
