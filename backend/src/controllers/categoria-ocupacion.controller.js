import { query } from '../db.js';

export const getCategorias = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM categoria_ocupacion ORDER BY orden ASC, nombre_es ASC');
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createCategoria = async (req, res, next) => {
  const { codigo, nombre_es, nombre_en, orden } = req.body;
  try {
    if (!codigo || !codigo.trim() || !nombre_es || !nombre_es.trim() || !nombre_en || !nombre_en.trim()) {
      return res.status(400).json({ message: 'Código, nombre en español e inglés son obligatorios.' });
    }
    const result = await query(
      `INSERT INTO categoria_ocupacion (codigo, nombre_es, nombre_en, orden)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [codigo.trim().toUpperCase(), nombre_es.trim(), nombre_en.trim(), orden || 0]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ya existe una categoría con ese código.' });
    }
    next(error);
  }
};

export const updateCategoria = async (req, res, next) => {
  const { id } = req.params;
  const { codigo, nombre_es, nombre_en, orden, activo } = req.body;
  try {
    if (!codigo || !codigo.trim() || !nombre_es || !nombre_es.trim() || !nombre_en || !nombre_en.trim()) {
      return res.status(400).json({ message: 'Código, nombre en español e inglés son obligatorios.' });
    }
    const result = await query(
      `UPDATE categoria_ocupacion
       SET codigo = $1, nombre_es = $2, nombre_en = $3, orden = $4, activo = $5
       WHERE id = $6 RETURNING *`,
      [codigo.trim().toUpperCase(), nombre_es.trim(), nombre_en.trim(), orden || 0, activo !== false, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada.' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ya existe una categoría con ese código.' });
    }
    next(error);
  }
};

export const toggleEstadoCategoria = async (req, res, next) => {
  const { id } = req.params;
  try {
    const actual = await query('SELECT activo FROM categoria_ocupacion WHERE id = $1', [id]);
    if (actual.rows.length === 0) {
      return res.status(404).json({ message: 'Categoría no encontrada.' });
    }
    const result = await query(
      'UPDATE categoria_ocupacion SET activo = $1 WHERE id = $2 RETURNING *',
      [!actual.rows[0].activo, id]
    );
    return res.status(200).json({ message: 'Estado actualizado correctamente.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
