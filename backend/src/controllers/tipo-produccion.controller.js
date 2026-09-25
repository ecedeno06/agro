import { query } from '../db.js';

// Listar todos los tipos de producción
export const getTipoProduccion = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM public.tipo_produccion ORDER BY id_tipo ASC');
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Registrar nuevo tipo de producción
export const createTipoProduccion = async (req, res, next) => {
  const { nombre, descripcion } = req.body;
  try {
    if (!nombre) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }
    const result = await query(
      'INSERT INTO public.tipo_produccion (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre.trim(), descripcion ? descripcion.trim() : null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Actualizar tipo de producción
export const updateTipoProduccion = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;
  try {
    if (!nombre) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }

    const checkRes = await query('SELECT 1 FROM public.tipo_produccion WHERE id_tipo = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de producción no encontrado.' });
    }

    const result = await query(
      'UPDATE public.tipo_produccion SET nombre = $1, descripcion = $2 WHERE id_tipo = $3 RETURNING *',
      [nombre.trim(), descripcion ? descripcion.trim() : null, id]
    );
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

// Eliminar tipo de producción (si no está en uso por ninguna finca)
export const deleteTipoProduccion = async (req, res, next) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT 1 FROM public.tipo_produccion WHERE id_tipo = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Tipo de producción no encontrado.' });
    }

    const enUso = await query('SELECT id_finca FROM public.fincas WHERE id_tipo_produccion = $1 LIMIT 1', [id]);
    if (enUso.rows.length > 0) {
      return res.status(409).json({ message: 'No se puede eliminar: hay fincas registradas con este tipo de producción.' });
    }

    await query('DELETE FROM public.tipo_produccion WHERE id_tipo = $1', [id]);
    return res.status(200).json({ message: 'Tipo de producción eliminado correctamente.' });
  } catch (error) {
    next(error);
  }
};
