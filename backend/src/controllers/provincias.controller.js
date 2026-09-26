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
