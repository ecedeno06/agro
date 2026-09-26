import { query } from '../db.js';

// GET /api/distritos?provincia_id=
export const getDistritos = async (req, res, next) => {
  const { provincia_id } = req.query;
  try {
    if (!provincia_id) {
      return res.status(400).json({ message: 'Se requiere provincia_id.' });
    }
    const result = await query(
      'SELECT * FROM distrito WHERE provincia_id = $1 ORDER BY nombre ASC',
      [provincia_id]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

// POST /api/distritos
export const createDistrito = async (req, res, next) => {
  const { provincia_id, nombre, codigo_iso, tipo } = req.body;
  try {
    if (!provincia_id || !nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'Provincia y nombre son obligatorios.' });
    }
    const result = await query(
      `INSERT INTO distrito (provincia_id, codigo_iso, nombre, tipo)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [provincia_id, codigo_iso || null, nombre.trim(), tipo || 'distrito']
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// PUT /api/distritos/:id
export const updateDistrito = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, codigo_iso, tipo } = req.body;
  try {
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }
    const result = await query(
      `UPDATE distrito SET nombre = $1, codigo_iso = $2, tipo = $3
       WHERE id = $4 RETURNING *`,
      [nombre.trim(), codigo_iso || null, tipo || 'distrito', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Distrito no encontrado.' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/distritos/:id
export const deleteDistrito = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM distrito WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Distrito no encontrado.' });
    }
    return res.status(200).json({ message: 'Distrito eliminado correctamente.' });
  } catch (error) {
    next(error);
  }
};
