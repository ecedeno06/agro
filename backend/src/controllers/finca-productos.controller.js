import { query } from '../db.js';

/**
 * Auxiliar para validar que la suma de áreas de producciones activas
 * no supere el tamaño total de la finca.
 */
async function validarAreaFinca(res, finca_id, areaNueva, excludeId = null) {
  const nuevaAreaNum = areaNueva != null && areaNueva !== '' ? Number(areaNueva) : 0;
  if (nuevaAreaNum <= 0) return true;

  // 1. Obtener tamaño total de la finca
  const resFinca = await query('SELECT tamano, nombre_finca FROM public.fincas WHERE id_finca = $1', [finca_id]);
  if (resFinca.rows.length === 0) return true;

  const tamanoTotal = Number(resFinca.rows[0].tamano || 0);
  if (tamanoTotal <= 0) return true;

  // 2. Sumar áreas de producciones activas existentes para esa finca
  let sumQuery = `SELECT COALESCE(SUM(area_produccion), 0) AS area_usada FROM public.finca_productos WHERE finca_id = $1 AND activo = true`;
  const params = [finca_id];

  if (excludeId) {
    params.push(excludeId);
    sumQuery += ` AND id != $2`;
  }

  const resSum = await query(sumQuery, params);
  const areaUsada = Number(resSum.rows[0].area_usada || 0);

  const areaTotalProyectada = Number((areaUsada + nuevaAreaNum).toFixed(2));
  const areaDisponible = Number((tamanoTotal - areaUsada).toFixed(2));

  if (areaTotalProyectada > tamanoTotal) {
    const dispLabel = areaDisponible > 0 ? areaDisponible : 0;
    res.status(400).json({
      message: `El área de producción (${nuevaAreaNum} Ha) supera el tamaño total de la finca (${tamanoTotal} Ha). Área en producción actual: ${areaUsada} Ha. Disponible: ${dispLabel} Ha.`
    });
    return false;
  }

  return true;
}

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

    // Traer información de producciones y tamaño total de la finca
    const fincaRes = await query('SELECT tamano, nombre_finca FROM public.fincas WHERE id_finca = $1', [finca_id]);
    const tamanoFinca = fincaRes.rows.length > 0 ? Number(fincaRes.rows[0].tamano || 0) : 0;

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

    const areaUsadaTotal = result.rows
      .filter(r => r.activo && r.area_produccion)
      .reduce((sum, r) => sum + Number(r.area_produccion), 0);

    return res.status(200).json({
      tamanoFinca,
      areaUsadaTotal: Number(areaUsadaTotal.toFixed(2)),
      areaDisponible: Number(Math.max(0, tamanoFinca - areaUsadaTotal).toFixed(2)),
      rows: result.rows
    });
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

    // Validar límite de área si la producción es activa
    if (activo !== false && area_produccion) {
      const ok = await validarAreaFinca(res, finca_id, area_produccion);
      if (!ok) return;
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
    // Obtener finca_id actual si no viene en body
    let targetFincaId = finca_id;
    if (!targetFincaId) {
      const actual = await query('SELECT finca_id FROM public.finca_productos WHERE id = $1', [id]);
      if (actual.rows.length === 0) {
        return res.status(404).json({ message: 'Registro de producción no encontrado.' });
      }
      targetFincaId = actual.rows[0].finca_id;
    }

    // Validar límite de área si está activa
    if (activo !== false && area_produccion) {
      const ok = await validarAreaFinca(res, targetFincaId, area_produccion, id);
      if (!ok) return;
    }

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
    const actual = await query('SELECT finca_id, area_produccion, activo FROM public.finca_productos WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      return res.status(404).json({ message: 'Registro de producción no encontrado.' });
    }

    const nuevoEstado = !actual.rows[0].activo;

    if (nuevoEstado && actual.rows[0].area_produccion) {
      const ok = await validarAreaFinca(res, actual.rows[0].finca_id, actual.rows[0].area_produccion, id);
      if (!ok) return;
    }

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
