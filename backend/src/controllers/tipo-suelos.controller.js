import { query } from '../db.js';

// Listar todos los tipos de suelos
export const getTipoSuelos = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM public.tipo_suelos ORDER BY id ASC');
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Registrar nuevo tipo de suelo
export const createTipoSuelo = async (req, res, next) => {
  const { nombre, descripcion } = req.body;
  try {
    if (!nombre) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }
    const result = await query(
      'INSERT INTO public.tipo_suelos (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre.trim(), descripcion ? descripcion.trim() : null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Actualizar tipo de suelo
export const updateTipoSuelo = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, descripcion, estado } = req.body;
  try {
    if (!nombre) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }

    const checkRes = await query('SELECT 1 FROM public.tipo_suelos WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de suelo no encontrado.' });
    }

    const result = await query(
      'UPDATE public.tipo_suelos SET nombre = $1, descripcion = $2, estado = $3 WHERE id = $4 RETURNING *',
      [nombre.trim(), descripcion ? descripcion.trim() : null, estado !== false, id]
    );
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Eliminar/Desactivar tipo de suelo
export const deleteTipoSuelo = async (req, res, next) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT 1 FROM public.tipo_suelos WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de suelo no encontrado.' });
    }

    // Eliminación lógica (desactivar)
    const result = await query(
      'UPDATE public.tipo_suelos SET estado = false WHERE id = $1 RETURNING *',
      [id]
    );
    return res.status(200).json({ message: 'Tipo de suelo desactivado correctamente.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
