import { query } from '../db.js';

/**
 * Obtener todos los fenómenos atmosféricos
 */
export const getFenomenos = async (req, res, next) => {
  try {
    const result = await query(`
      SELECT 
        id_fenomeno AS "idFenomeno",
        nombre,
        periodo_meses AS "periodoMeses",
        tipo_impacto AS "tipoImpacto",
        porcentaje_merma AS "porcentajeMerma",
        descripcion,
        medidas_mitigacion AS "medidasMitigacion",
        activo,
        fecha_creacion AS "fechaCreacion"
      FROM public.fenomenos
      ORDER BY id_fenomeno ASC
    `);
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener un fenómeno por ID
 */
export const getFenomenoById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await query(`
      SELECT 
        id_fenomeno AS "idFenomeno",
        nombre,
        periodo_meses AS "periodoMeses",
        tipo_impacto AS "tipoImpacto",
        porcentaje_merma AS "porcentajeMerma",
        descripcion,
        medidas_mitigacion AS "medidasMitigacion",
        activo,
        fecha_creacion AS "fechaCreacion"
      FROM public.fenomenos
      WHERE id_fenomeno = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Fenómeno atmosférico no encontrado.' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear nuevo fenómeno atmosférico
 */
export const crearFenomeno = async (req, res, next) => {
  const { nombre, periodoMeses, tipoImpacto, porcentajeMerma, descripcion, medidasMitigacion, activo } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ message: 'El nombre del fenómeno es obligatorio.' });
  }
  if (!periodoMeses || !periodoMeses.trim()) {
    return res.status(400).json({ message: 'El período de meses de afectación es obligatorio.' });
  }
  if (!tipoImpacto || !tipoImpacto.trim()) {
    return res.status(400).json({ message: 'El tipo de impacto es obligatorio.' });
  }

  const mermaNum = parseFloat(porcentajeMerma) || 0;
  if (mermaNum < 0 || mermaNum > 100) {
    return res.status(400).json({ message: 'El porcentaje de merma debe estar entre 0% y 100%.' });
  }

  try {
    const result = await query(`
      INSERT INTO public.fenomenos (nombre, periodo_meses, tipo_impacto, porcentaje_merma, descripcion, medidas_mitigacion, activo)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING 
        id_fenomeno AS "idFenomeno",
        nombre,
        periodo_meses AS "periodoMeses",
        tipo_impacto AS "tipoImpacto",
        porcentaje_merma AS "porcentajeMerma",
        descripcion,
        medidas_mitigacion AS "medidasMitigacion",
        activo,
        fecha_creacion AS "fechaCreacion"
    `, [
      nombre.trim(),
      periodoMeses.trim(),
      tipoImpacto.trim(),
      mermaNum,
      descripcion ? descripcion.trim() : null,
      medidasMitigacion ? medidasMitigacion.trim() : null,
      activo !== undefined ? Boolean(activo) : true
    ]);

    return res.status(201).json({
      message: 'Fenómeno atmosférico registrado exitosamente.',
      fenomeno: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar fenómeno existente
 */
export const actualizarFenomeno = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, periodoMeses, tipoImpacto, porcentajeMerma, descripcion, medidasMitigacion, activo } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ message: 'El nombre del fenómeno es obligatorio.' });
  }
  if (!periodoMeses || !periodoMeses.trim()) {
    return res.status(400).json({ message: 'El período de meses de afectación es obligatorio.' });
  }
  if (!tipoImpacto || !tipoImpacto.trim()) {
    return res.status(400).json({ message: 'El tipo de impacto es obligatorio.' });
  }

  const mermaNum = parseFloat(porcentajeMerma) || 0;
  if (mermaNum < 0 || mermaNum > 100) {
    return res.status(400).json({ message: 'El porcentaje de merma debe estar entre 0% y 100%.' });
  }

  try {
    const checkRes = await query('SELECT id_fenomeno FROM public.fenomenos WHERE id_fenomeno = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Fenómeno atmosférico no encontrado.' });
    }

    const result = await query(`
      UPDATE public.fenomenos
      SET 
        nombre = $1,
        periodo_meses = $2,
        tipo_impacto = $3,
        porcentaje_merma = $4,
        descripcion = $5,
        medidas_mitigacion = $6,
        activo = $7
      WHERE id_fenomeno = $8
      RETURNING 
        id_fenomeno AS "idFenomeno",
        nombre,
        periodo_meses AS "periodoMeses",
        tipo_impacto AS "tipoImpacto",
        porcentaje_merma AS "porcentajeMerma",
        descripcion,
        medidas_mitigacion AS "medidasMitigacion",
        activo,
        fecha_creacion AS "fechaCreacion"
    `, [
      nombre.trim(),
      periodoMeses.trim(),
      tipoImpacto.trim(),
      mermaNum,
      descripcion ? descripcion.trim() : null,
      medidasMitigacion ? medidasMitigacion.trim() : null,
      activo !== undefined ? Boolean(activo) : true,
      id
    ]);

    return res.status(200).json({
      message: 'Fenómeno atmosférico actualizado exitosamente.',
      fenomeno: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Conmutar estado activo/inactivo de un fenómeno
 */
export const toggleEstadoFenomeno = async (req, res, next) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT id_fenomeno, activo FROM public.fenomenos WHERE id_fenomeno = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Fenómeno atmosférico no encontrado.' });
    }

    const nuevoEstado = !checkRes.rows[0].activo;
    await query('UPDATE public.fenomenos SET activo = $1 WHERE id_fenomeno = $2', [nuevoEstado, id]);

    return res.status(200).json({
      message: `El fenómeno fue ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente.`,
      activo: nuevoEstado
    });
  } catch (error) {
    next(error);
  }
};
