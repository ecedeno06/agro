import { query } from '../db.js';
import { resolverScope } from '../security/scope.helper.js';
import { tienePermisoMenu } from '../security/permisos.helper.js';

// Fila de public.menus para "Productos" (el catálogo de productos vive bajo el mismo módulo).
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

const BASE64_IMAGEN_REGEX = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
const MAX_IMAGEN_BYTES = 2 * 1024 * 1024; // 2 MB

// La imagen del producto es opcional; si viene, debe ser base64 (mismo patrón que el avatar de usuario).
function validarImagenBase64(res, imagenUrl) {
  if (!imagenUrl) return true;
  if (!BASE64_IMAGEN_REGEX.test(imagenUrl)) {
    res.status(400).json({ message: 'Formato de imagen inválido. Se esperaba una foto en base64.' });
    return false;
  }
  const sizeBytes = Buffer.byteLength(imagenUrl.split(',')[1] || '', 'base64');
  if (sizeBytes > MAX_IMAGEN_BYTES) {
    res.status(400).json({ message: 'La imagen es demasiado grande. El límite es 2 MB.' });
    return false;
  }
  return true;
}

// GET /api/catalogo-productos?categoria_id=
export const getProductos = async (req, res, next) => {
  const { categoria_id } = req.query;
  try {
    if (!(await verificarPermiso(req, res, 'ver'))) return;
    const base = `
      SELECT p.*, c.nombre AS categoria_nombre, u.nombre AS unidad_nombre, u.abrev AS unidad_abrev
      FROM public.catalogo_productos p
      JOIN public.categorias c ON c.id = p.categoria_id
      LEFT JOIN public.unidades_medida u ON u.id = p.unidad_medida_id`;

    if (categoria_id) {
      const result = await query(
        `${base} WHERE p.categoria_id = $1 ORDER BY p.nombre ASC`,
        [categoria_id]
      );
      return res.status(200).json(result.rows);
    }
    const result = await query(`${base} ORDER BY c.nombre ASC, p.nombre ASC`);
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createProducto = async (req, res, next) => {
  const { categoria_id, unidad_medida_id, nombre, descripcion, codigo, imagen_url } = req.body;
  try {
    if (!(await verificarPermiso(req, res, 'crear'))) return;
    if (!categoria_id || !nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'Categoría y nombre son obligatorios.' });
    }
    if (!validarImagenBase64(res, imagen_url)) return;
    const result = await query(
      `INSERT INTO public.catalogo_productos (categoria_id, unidad_medida_id, nombre, descripcion, codigo, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        categoria_id,
        unidad_medida_id || null,
        nombre.trim(),
        descripcion ? descripcion.trim() : null,
        codigo ? codigo.trim().toUpperCase() : null,
        imagen_url ? imagen_url.trim() : null
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ya existe un producto con ese código.' });
    }
    next(error);
  }
};

export const updateProducto = async (req, res, next) => {
  const { id } = req.params;
  const { categoria_id, unidad_medida_id, nombre, descripcion, codigo, imagen_url, activo } = req.body;
  try {
    if (!(await verificarPermiso(req, res, 'editar'))) return;
    if (!categoria_id || !nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'Categoría y nombre son obligatorios.' });
    }
    if (!validarImagenBase64(res, imagen_url)) return;
    const result = await query(
      `UPDATE public.catalogo_productos
       SET categoria_id = $1, unidad_medida_id = $2, nombre = $3, descripcion = $4,
           codigo = $5, imagen_url = $6, activo = $7
       WHERE id = $8 RETURNING *`,
      [
        categoria_id,
        unidad_medida_id || null,
        nombre.trim(),
        descripcion ? descripcion.trim() : null,
        codigo ? codigo.trim().toUpperCase() : null,
        imagen_url ? imagen_url.trim() : null,
        activo !== false,
        id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ya existe un producto con ese código.' });
    }
    next(error);
  }
};

export const toggleEstadoProducto = async (req, res, next) => {
  const { id } = req.params;
  try {
    if (!(await verificarPermiso(req, res, 'eliminar'))) return;
    const actual = await query('SELECT activo FROM public.catalogo_productos WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }
    const result = await query(
      'UPDATE public.catalogo_productos SET activo = $1 WHERE id = $2 RETURNING *',
      [!actual.rows[0].activo, id]
    );
    return res.status(200).json({ message: 'Estado actualizado correctamente.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
