import { query } from '../db.js';

// GET /api/unidades-medida
export const getUnidadesMedida = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM public.unidades_medida ORDER BY nombre ASC');
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};
