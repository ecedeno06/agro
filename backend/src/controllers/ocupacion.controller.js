import { query } from '../db.js';

// GET /api/ocupaciones?categoria_id=
export const getOcupaciones = async (req, res, next) => {
  const { categoria_id } = req.query;
  try {
    if (categoria_id) {
      const result = await query(
        'SELECT * FROM ocupacion WHERE categoria_id = $1 ORDER BY orden ASC, nombre_es ASC',
        [categoria_id]
      );
      return res.status(200).json(result.rows);
    }
    const result = await query('SELECT * FROM ocupacion ORDER BY categoria_id ASC, orden ASC, nombre_es ASC');
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createOcupacion = async (req, res, next) => {
  const { categoria_id, codigo, nombre_es, nombre_en, codigo_ciuo, requiere_detalle, orden } = req.body;
  try {
    if (!categoria_id || !codigo || !codigo.trim() || !nombre_es || !nombre_es.trim() || !nombre_en || !nombre_en.trim()) {
      return res.status(400).json({ message: 'Categoría, código, nombre en español e inglés son obligatorios.' });
    }
    const result = await query(
      `INSERT INTO ocupacion (categoria_id, codigo, nombre_es, nombre_en, codigo_ciuo, requiere_detalle, orden)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        categoria_id,
        codigo.trim().toUpperCase(),
        nombre_es.trim(),
        nombre_en.trim(),
        codigo_ciuo ? codigo_ciuo.trim() : null,
        !!requiere_detalle,
        orden || 0
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ya existe una ocupación con ese código.' });
    }
    next(error);
  }
};

export const updateOcupacion = async (req, res, next) => {
  const { id } = req.params;
  const { codigo, nombre_es, nombre_en, codigo_ciuo, requiere_detalle, orden, activo } = req.body;
  try {
    if (!codigo || !codigo.trim() || !nombre_es || !nombre_es.trim() || !nombre_en || !nombre_en.trim()) {
      return res.status(400).json({ message: 'Código, nombre en español e inglés son obligatorios.' });
    }
    const result = await query(
      `UPDATE ocupacion
       SET codigo = $1, nombre_es = $2, nombre_en = $3, codigo_ciuo = $4, requiere_detalle = $5, orden = $6, activo = $7
       WHERE id = $8 RETURNING *`,
      [
        codigo.trim().toUpperCase(),
        nombre_es.trim(),
        nombre_en.trim(),
        codigo_ciuo ? codigo_ciuo.trim() : null,
        !!requiere_detalle,
        orden || 0,
        activo !== false,
        id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Ocupación no encontrada.' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ya existe una ocupación con ese código.' });
    }
    next(error);
  }
};

export const toggleEstadoOcupacion = async (req, res, next) => {
  const { id } = req.params;
  try {
    const actual = await query('SELECT activo FROM ocupacion WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      return res.status(404).json({ message: 'Ocupación no encontrada.' });
    }
    const result = await query(
      'UPDATE ocupacion SET activo = $1 WHERE id = $2 RETURNING *',
      [!actual.rows[0].activo, id]
    );
    return res.status(200).json({ message: 'Estado actualizado correctamente.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
