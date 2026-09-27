import { query } from '../db.js';
import { resolverScope } from '../security/scope.helper.js';
import { tienePermisoMenu } from '../security/permisos.helper.js';

// Fila de public.menus para "Productos" (también rige Categorías, submenú funcional del mismo módulo).
const MENU_ID_PRODUCTOS = 7;

async function verificarPermiso(req, res, codigoPermiso) {
  const { esGlobal } = resolverScope(req);
  if (esGlobal) return true;
  const tiene = await tienePermisoMenu(req.userRolId, req.userId, MENU_ID_PRODUCTOS, codigoPermiso);
  if (!tiene) {
    res.status(403).json({
      message: `Acceso denegado. Su rol no tiene el permiso "${codigoPermiso}" asignado para Productos/Categorías.`
    });
  }
  return tiene;
}

// GET /api/categorias-producto?padre_id= (si no se pasa, devuelve todas)
export const getCategorias = async (req, res, next) => {
  const { padre_id } = req.query;
  try {
    if (!(await verificarPermiso(req, res, 'ver'))) return;
    if (padre_id) {
      const result = await query(
        'SELECT * FROM public.categorias WHERE categoria_padre_id = $1 ORDER BY orden ASC, nombre ASC',
        [padre_id]
      );
      return res.status(200).json(result.rows);
    }
    const result = await query('SELECT * FROM public.categorias ORDER BY orden ASC, nombre ASC');
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createCategoria = async (req, res, next) => {
  const { nombre, icono, categoria_padre_id, orden } = req.body;
  try {
    if (!(await verificarPermiso(req, res, 'crear'))) return;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }
    const result = await query(
      `INSERT INTO public.categorias (nombre, icono, categoria_padre_id, orden)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre.trim(), icono || null, categoria_padre_id || null, orden || 0]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const updateCategoria = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, icono, orden } = req.body;
  try {
    if (!(await verificarPermiso(req, res, 'editar'))) return;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }
    const result = await query(
      `UPDATE public.categorias SET nombre = $1, icono = $2, orden = $3
       WHERE id = $4 RETURNING *`,
      [nombre.trim(), icono || null, orden || 0, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada.' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const toggleEstadoCategoria = async (req, res, next) => {
  const { id } = req.params;
  try {
    if (!(await verificarPermiso(req, res, 'eliminar'))) return;
    const actual = await query('SELECT activo FROM public.categorias WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada.' });
    }
    const result = await query(
      'UPDATE public.categorias SET activo = $1 WHERE id = $2 RETURNING *',
      [!actual.rows[0].activo, id]
    );
    return res.status(200).json({ message: 'Estado actualizado correctamente.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
