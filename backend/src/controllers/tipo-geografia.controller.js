import { query } from '../db.js';

// Listar todos los tipos de geografía
export const getTipoGeografia = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id_tipo_geografia AS id, id_tipo_geografia, descripcion AS nombre, descripcion, COALESCE(activa, true) AS estado, fecha_creacion FROM public.tipo_geografia ORDER BY id_tipo_geografia ASC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Registrar nuevo tipo de geografía
export const createTipoGeografia = async (req, res, next) => {
  const { nombre, descripcion } = req.body;
  const textoDesc = (descripcion || nombre || '').trim();
  try {
    if (!textoDesc) {
      return res.status(400).json({ message: 'La descripción es obligatoria.' });
    }
    const result = await query(
      'INSERT INTO public.tipo_geografia (descripcion, activa, fecha_creacion) VALUES ($1, true, NOW()) RETURNING id_tipo_geografia AS id, descripcion AS nombre, descripcion, activa AS estado',
      [textoDesc]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Actualizar tipo de geografía
export const updateTipoGeografia = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, descripcion, estado } = req.body;
  const textoDesc = (descripcion || nombre || '').trim();
  try {
    if (!textoDesc) {
      return res.status(400).json({ message: 'La descripción es obligatoria.' });
    }

    const checkRes = await query('SELECT 1 FROM public.tipo_geografia WHERE id_tipo_geografia = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de geografía no encontrado.' });
    }

    const result = await query(
      'UPDATE public.tipo_geografia SET descripcion = $1, activa = $2 WHERE id_tipo_geografia = $3 RETURNING id_tipo_geografia AS id, descripcion AS nombre, descripcion, activa AS estado',
      [textoDesc, estado !== false, id]
    );
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Eliminar/Desactivar tipo de geografía
export const deleteTipoGeografia = async (req, res, next) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT 1 FROM public.tipo_geografia WHERE id_tipo_geografia = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de geografía no encontrado.' });
    }

    const result = await query(
      'UPDATE public.tipo_geografia SET activa = false WHERE id_tipo_geografia = $1 RETURNING id_tipo_geografia AS id, descripcion AS nombre, descripcion, activa AS estado',
      [id]
    );
    return res.status(200).json({ message: 'Tipo de geografía desactivado correctamente.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
