import { query } from '../db.js';

// GET /api/provincias?pais_id= | ?codigo_iso2=
export const getProvincias = async (req, res, next) => {
  const { pais_id, codigo_iso2 } = req.query;
  try {
    if (codigo_iso2) {
      const result = await query(
        `SELECT pr.* FROM provincia pr
         JOIN catalogo_paises cp ON cp.id = pr.pais_id
         WHERE cp.codigo_iso2 = $1
         ORDER BY pr.nombre ASC`,
        [codigo_iso2.trim().toUpperCase()]
      );
      return res.status(200).json(result.rows);
    }

    if (pais_id) {
      const result = await query(
        'SELECT * FROM provincia WHERE pais_id = $1 ORDER BY nombre ASC',
        [pais_id]
      );
      return res.status(200).json(result.rows);
    }

    return res.status(400).json({ message: 'Se requiere pais_id o codigo_iso2.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/provincias
export const createProvincia = async (req, res, next) => {
  const { pais_id, nombre, nombre_ingles, codigo_iso, tipo } = req.body;
  try {
    if (!pais_id || !nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'País y nombre son obligatorios.' });
    }
    const result = await query(
      `INSERT INTO provincia (pais_id, codigo_iso, nombre, nombre_ingles, tipo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [pais_id, codigo_iso || null, nombre.trim(), (nombre_ingles && nombre_ingles.trim()) || nombre.trim(), tipo || 'provincia']
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// PUT /api/provincias/:id
export const updateProvincia = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, nombre_ingles, codigo_iso, tipo } = req.body;
  try {
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }
    const result = await query(
      `UPDATE provincia SET nombre = $1, nombre_ingles = $2, codigo_iso = $3, tipo = $4
       WHERE id = $5 RETURNING *`,
      [nombre.trim(), (nombre_ingles && nombre_ingles.trim()) || nombre.trim(), codigo_iso || null, tipo || 'provincia', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Provincia no encontrada.' });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/provincias/:id
export const deleteProvincia = async (req, res, next) => {
  const { id } = req.params;
  try {
    const enUso = await query('SELECT 1 FROM distrito WHERE provincia_id = $1 LIMIT 1', [id]);
    if (enUso.rows.length > 0) {
      return res.status(409).json({ message: 'No se puede eliminar: la provincia tiene distritos asociados.' });
    }
    const result = await query('DELETE FROM provincia WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Provincia no encontrada.' });
    }
    return res.status(200).json({ message: 'Provincia eliminada correctamente.' });
  } catch (error) {
    next(error);
  }
};
