import { query } from '../db.js';

/**
 * Obtener todos los registros de producción (finca_productos) asociados a una finca.
 * GET /api/fincas-productos?finca_id=...
 */
export const getFincaProductos = async (req, res, next) => {
  const { finca_id } = req.query;

  try {
    if (!finca_id) {
      return res.status(400).json({ message: 'El parámetro finca_id es obligatorio.' });
    }

    const result = await query(
      `SELECT 
         fp.*,
         c.nombre AS nombre_categoria,
         c.icono AS icono_categoria,
         cp.nombre AS nombre_subproducto,
         cp.codigo AS codigo_subproducto
       FROM public.finca_productos fp
       LEFT JOIN public.categorias c ON fp.categoria_producto = c.id
       LEFT JOIN public.catalogo_productos cp ON (fp.subproducto_id = cp.id OR fp.producto_id = cp.id)
       WHERE fp.finca_id = $1
       ORDER BY fp.activo DESC, fp.id DESC`,
      [finca_id]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Registrar una nueva producción en una finca.
 * POST /api/fincas-productos
 */
export const addFincaProducto = async (req, res, next) => {
  const {
    finca_id,
    categoria_producto,
    subproducto_id,
    area_produccion,
    desde,
    hasta,
    precio,
    stock,
    activo
  } = req.body;

  try {
    if (!finca_id || (!categoria_producto && !subproducto_id)) {
      return res.status(400).json({
        message: 'La finca y al menos la categoría o subproducto son obligatorios.'
      });
    }

    const prodId = subproducto_id || null;

    const result = await query(
      `INSERT INTO public.finca_productos (
         finca_id,
         categoria_producto,
         subproducto_id,
         producto_id,
         area_produccion,
         desde,
         hasta,
         precio,
         stock,
         activo
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        finca_id,
        categoria_producto || null,
        prodId,
        prodId,
        area_produccion != null && area_produccion !== '' ? Number(area_produccion) : null,
        desde || null,
        hasta || null,
        precio != null && precio !== '' ? Number(precio) : 0,
        stock != null && stock !== '' ? Number(stock) : 0,
        activo !== false
      ]
    );

    return res.status(201).json({
      message: 'Producción registrada exitosamente.',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar un registro de producción existente.
 * PUT /api/fincas-productos/:id
 */
export const updateFincaProducto = async (req, res, next) => {
  const { id } = req.params;
  const {
    categoria_producto,
    subproducto_id,
    area_produccion,
    desde,
    hasta,
    precio,
    stock,
    activo
  } = req.body;

  try {
    const prodId = subproducto_id || null;

    const result = await query(
      `UPDATE public.finca_productos
       SET categoria_producto = $1,
           subproducto_id = $2,
           producto_id = $3,
           area_produccion = $4,
           desde = $5,
           hasta = $6,
           precio = $7,
           stock = $8,
           activo = $9,
           actualizado_en = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        categoria_producto || null,
        prodId,
        prodId,
        area_produccion != null && area_produccion !== '' ? Number(area_produccion) : null,
        desde || null,
        hasta || null,
        precio != null && precio !== '' ? Number(precio) : 0,
        stock != null && stock !== '' ? Number(stock) : 0,
        activo !== false,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Registro de producción no encontrado.' });
    }

    return res.status(200).json({
      message: 'Producción actualizada exitosamente.',
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cambiar estado (Activar / Desactivar) de una producción.
 * PUT /api/fincas-productos/:id/toggle
 */
export const toggleEstadoFincaProducto = async (req, res, next) => {
  const { id } = req.params;

  try {
    const actual = await query('SELECT activo FROM public.finca_productos WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      return res.status(404).json({ message: 'Registro de producción no encontrado.' });
    }

    const nuevoEstado = !actual.rows[0].activo;

    const result = await query(
      `UPDATE public.finca_productos
       SET activo = $1, actualizado_en = NOW()
       WHERE id = $2
       RETURNING *`,
      [nuevoEstado, id]
    );

    return res.status(200).json({
      message: `Producción ${nuevoEstado ? 'activada' : 'desactivada'} exitosamente.`,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar un registro de producción.
 * DELETE /api/fincas-productos/:id
 */
export const deleteFincaProducto = async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await query('DELETE FROM public.finca_productos WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Registro de producción no encontrado.' });
    }

    return res.status(200).json({ message: 'Producción eliminada exitosamente.' });
  } catch (error) {
    next(error);
  }
};
