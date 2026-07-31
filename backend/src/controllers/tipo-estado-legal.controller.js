import { query } from '../db.js';

// Listar todos los tipos de estado legal
export const getTipoEstadoLegal = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id_estado_legal AS id, id_estado_legal, descripcion AS nombre, descripcion, COALESCE(activo, true) AS estado, fecha_creacion FROM public.tipo_estado_legal ORDER BY id_estado_legal ASC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Registrar nuevo tipo de estado legal
export const createTipoEstadoLegal = async (req, res, next) => {
  const { nombre, descripcion } = req.body;
  const textoDesc = (descripcion || nombre || '').trim();
  try {
    if (!textoDesc) {
      return res.status(400).json({ message: 'La descripción es obligatoria.' });
    }
    const result = await query(
      'INSERT INTO public.tipo_estado_legal (descripcion, activo) VALUES ($1, true) RETURNING id_estado_legal AS id, id_estado_legal, descripcion AS nombre, descripcion, activo AS estado',
      [textoDesc]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Actualizar tipo de estado legal
export const updateTipoEstadoLegal = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, descripcion, estado } = req.body;
  const textoDesc = (descripcion || nombre || '').trim();
  try {
    if (!textoDesc) {
      return res.status(400).json({ message: 'La descripción es obligatoria.' });
    }

    const checkRes = await query('SELECT 1 FROM public.tipo_estado_legal WHERE id_estado_legal = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de estado legal no encontrado.' });
    }

    const result = await query(
      'UPDATE public.tipo_estado_legal SET descripcion = $1, activo = $2 WHERE id_estado_legal = $3 RETURNING id_estado_legal AS id, id_estado_legal, descripcion AS nombre, descripcion, activo AS estado',
      [textoDesc, estado !== false, id]
    );
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Eliminar/Desactivar tipo de estado legal
export const deleteTipoEstadoLegal = async (req, res, next) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT 1 FROM public.tipo_estado_legal WHERE id_estado_legal = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de estado legal no encontrado.' });
    }

    const result = await query(
      'UPDATE public.tipo_estado_legal SET activo = false WHERE id_estado_legal = $1 RETURNING id_estado_legal AS id, id_estado_legal, descripcion AS nombre, descripcion, activo AS estado',
      [id]
    );
    return res.status(200).json({ message: 'Tipo de estado legal desactivado correctamente.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
