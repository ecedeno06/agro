import { query } from '../db.js';

/**
 * Obtener todos los fenómenos asociados a una finca específica
 */
export const getFenomenosPorFinca = async (req, res, next) => {
  const { idFinca } = req.params;
  try {
    const result = await query(`
      SELECT 
        ff.id,
        ff.id_finca AS "idFinca",
        ff.id_fenomeno AS "idFenomeno",
        ff.activo AS "asignacionActiva",
        f.nombre,
        f.periodo_meses AS "periodoMeses",
        f.tipo_impacto AS "tipoImpacto",
        f.porcentaje_merma AS "porcentajeMerma",
        f.descripcion,
        f.medidas_mitigacion AS "medidasMitigacion",
        f.activo AS "fenomenoCatalogoActivo"
      FROM public.finca_fenomenos ff
      JOIN public.fenomenos f ON ff.id_fenomeno = f.id_fenomeno
      WHERE ff.id_finca = $1
      ORDER BY ff.id ASC
    `, [idFinca]);

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Asociar/Asignar un fenómeno a una finca
 */
export const asignarFenomenoAFinca = async (req, res, next) => {
  const { idFinca, idFenomeno, activo } = req.body;

  if (!idFinca || !idFenomeno) {
    return res.status(400).json({ message: 'El ID de la finca y el ID del fenómeno son obligatorios.' });
  }

  try {
    // Comprobar si ya existe la asociación
    const checkRes = await query(`
      SELECT id, activo FROM public.finca_fenomenos
      WHERE id_finca = $1 AND id_fenomeno = $2
    `, [idFinca, idFenomeno]);

    if (checkRes.rows.length > 0) {
      // Si ya existe, reactivar o retornar mensaje
      const existId = checkRes.rows[0].id;
      const result = await query(`
        UPDATE public.finca_fenomenos
        SET activo = true
        WHERE id = $1
        RETURNING id, id_finca AS "idFinca", id_fenomeno AS "idFenomeno", activo
      `, [existId]);

      return res.status(200).json({
        message: 'El fenómeno atmosférico fue reasignado y activado en la finca.',
        fincaFenomeno: result.rows[0]
      });
    }

    const result = await query(`
      INSERT INTO public.finca_fenomenos (id_finca, id_fenomeno, activo)
      VALUES ($1, $2, $3)
      RETURNING id, id_finca AS "idFinca", id_fenomeno AS "idFenomeno", activo
    `, [idFinca, idFenomeno, activo !== undefined ? Boolean(activo) : true]);

    return res.status(201).json({
      message: 'Fenómeno atmosférico asignado exitosamente a la finca.',
      fincaFenomeno: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Conmutar estado (Activo/Inactivo) de la asignación del fenómeno en la finca
 */
export const toggleEstadoFincaFenomeno = async (req, res, next) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT id, activo FROM public.finca_fenomenos WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Asignación de fenómeno no encontrada.' });
    }

    const nuevoEstado = !checkRes.rows[0].activo;
    await query('UPDATE public.finca_fenomenos SET activo = $1 WHERE id = $2', [nuevoEstado, id]);

    return res.status(200).json({
      message: `Asignación de fenómeno ${nuevoEstado ? 'activada' : 'desactivada'} en la finca.`,
      activo: nuevoEstado
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar la asociación de un fenómeno con una finca
 */
export const eliminarFincaFenomeno = async (req, res, next) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT id FROM public.finca_fenomenos WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Asignación de fenómeno no encontrada.' });
    }

    await query('DELETE FROM public.finca_fenomenos WHERE id = $1', [id]);

    return res.status(200).json({ message: 'Fenómeno desasociado de la finca exitosamente.' });
  } catch (error) {
    next(error);
  }
};
