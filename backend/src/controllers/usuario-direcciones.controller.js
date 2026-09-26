import { query } from '../db.js';

/**
 * Direcciones del usuario autenticado (solo las propias -- este módulo no
 * expone direcciones de otros usuarios). Puede haber varias; una sola puede
 * estar marcada como "principal" a la vez.
 */

export const listarDirecciones = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM public.usuario_direcciones
       WHERE id_usuario = $1
       ORDER BY es_principal DESC, creado_en ASC`,
      [req.userId]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const crearDireccion = async (req, res, next) => {
  const { pais, provincia, distrito, corregimiento, direccion_texto, es_principal, google_maps_url, comparte_ubicacion } = req.body;

  try {
    if (!direccion_texto || !direccion_texto.trim()) {
      return res.status(400).json({ message: 'La dirección es obligatoria.' });
    }

    if (es_principal) {
      await query('UPDATE public.usuario_direcciones SET es_principal = false WHERE id_usuario = $1', [req.userId]);
    }

    const result = await query(
      `INSERT INTO public.usuario_direcciones
         (id_usuario, pais, provincia, distrito, corregimiento, direccion_texto, es_principal, google_maps_url, comparte_ubicacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.userId,
        pais || null,
        provincia || null,
        distrito || null,
        corregimiento || null,
        direccion_texto.trim(),
        !!es_principal,
        google_maps_url || null,
        !!comparte_ubicacion
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const actualizarDireccion = async (req, res, next) => {
  const { id } = req.params;
  const { pais, provincia, distrito, corregimiento, direccion_texto, es_principal, google_maps_url, comparte_ubicacion } = req.body;

  try {
    if (!direccion_texto || !direccion_texto.trim()) {
      return res.status(400).json({ message: 'La dirección es obligatoria.' });
    }

    const existente = await query(
      'SELECT id FROM public.usuario_direcciones WHERE id = $1 AND id_usuario = $2',
      [id, req.userId]
    );
    if (existente.rows.length === 0) {
      return res.status(404).json({ message: 'Dirección no encontrada.' });
    }

    if (es_principal) {
      await query(
        'UPDATE public.usuario_direcciones SET es_principal = false WHERE id_usuario = $1 AND id <> $2',
        [req.userId, id]
      );
    }

    const result = await query(
      `UPDATE public.usuario_direcciones SET
         pais = $1,
         provincia = $2,
         distrito = $3,
         corregimiento = $4,
         direccion_texto = $5,
         es_principal = $6,
         google_maps_url = $7,
         comparte_ubicacion = $8,
         actualizado_en = NOW()
       WHERE id = $9 AND id_usuario = $10
       RETURNING *`,
      [
        pais || null,
        provincia || null,
        distrito || null,
        corregimiento || null,
        direccion_texto.trim(),
        !!es_principal,
        google_maps_url || null,
        !!comparte_ubicacion,
        id,
        req.userId
      ]
    );

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const eliminarDireccion = async (req, res, next) => {
  const { id } = req.params;

  try {
    const result = await query(
      'DELETE FROM public.usuario_direcciones WHERE id = $1 AND id_usuario = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Dirección no encontrada.' });
    }

    return res.status(200).json({ message: 'Dirección eliminada correctamente.' });
  } catch (error) {
    next(error);
  }
};
