import { query } from '../db.js';

// Listar todos los tipos de terreno
export const getTipoTerreno = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM public.tipo_terreno ORDER BY id ASC');
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Registrar nuevo tipo de terreno
export const createTipoTerreno = async (req, res, next) => {
  const { nombre, descripcion } = req.body;
  try {
    if (!nombre) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }
    const result = await query(
      'INSERT INTO public.tipo_terreno (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre.trim(), descripcion ? descripcion.trim() : null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Actualizar tipo de terreno
export const updateTipoTerreno = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, descripcion, estado } = req.body;
  try {
    if (!nombre) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }

    const checkRes = await query('SELECT 1 FROM public.tipo_terreno WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de terreno no encontrado.' });
    }

    const result = await query(
      'UPDATE public.tipo_terreno SET nombre = $1, descripcion = $2, estado = $3 WHERE id = $4 RETURNING *',
      [nombre.trim(), descripcion ? descripcion.trim() : null, estado !== false, id]
    );
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Eliminar/Desactivar tipo de terreno
export const deleteTipoTerreno = async (req, res, next) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT 1 FROM public.tipo_terreno WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de terreno no encontrado.' });
    }

    const result = await query(
      'UPDATE public.tipo_terreno SET estado = false WHERE id = $1 RETURNING *',
      [id]
    );
    return res.status(200).json({ message: 'Tipo de terreno desactivado correctamente.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
