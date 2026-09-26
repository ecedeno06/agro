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
