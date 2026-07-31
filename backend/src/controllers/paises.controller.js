import { query } from '../db.js';

// Listar todos los países
export const getPaises = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM public.catalogo_paises ORDER BY nombre ASC');
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Registrar nuevo país
export const createPais = async (req, res, next) => {
  const { nombre, codigo_iso2, codigo_iso3, nacionalidad, moneda, idioma_oficial } = req.body;
  try {
    if (!nombre || !codigo_iso2 || !codigo_iso3 || !nacionalidad) {
      return res.status(400).json({ message: 'Nombre, código ISO2, código ISO3 y nacionalidad son obligatorios.' });
    }
    const result = await query(
      `INSERT INTO public.catalogo_paises (nombre, codigo_iso2, codigo_iso3, nacionalidad, moneda, idioma_oficial)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre.trim(), codigo_iso2.trim().toUpperCase(), codigo_iso3.trim().toUpperCase(), nacionalidad.trim(), moneda ? moneda.trim() : null, idioma_oficial ? idioma_oficial.trim() : null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ya existe un país con ese nombre o código ISO.' });
    }
    next(error);
  }
};

// Actualizar país
export const updatePais = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, codigo_iso2, codigo_iso3, nacionalidad, moneda, idioma_oficial, activo } = req.body;
  try {
    if (!nombre || !codigo_iso2 || !codigo_iso3 || !nacionalidad) {
      return res.status(400).json({ message: 'Nombre, código ISO2, código ISO3 y nacionalidad son obligatorios.' });
    }

    const checkRes = await query('SELECT 1 FROM public.catalogo_paises WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'País no encontrado.' });
    }

    const result = await query(
      `UPDATE public.catalogo_paises
       SET nombre = $1, codigo_iso2 = $2, codigo_iso3 = $3, nacionalidad = $4, moneda = $5, idioma_oficial = $6, activo = $7
       WHERE id = $8 RETURNING *`,
      [nombre.trim(), codigo_iso2.trim().toUpperCase(), codigo_iso3.trim().toUpperCase(), nacionalidad.trim(), moneda ? moneda.trim() : null, idioma_oficial ? idioma_oficial.trim() : null, activo !== false, id]
    );
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'Ya existe un país con ese nombre o código ISO.' });
    }
    next(error);
  }
};

// Eliminar/Desactivar país
export const deletePais = async (req, res, next) => {
  const { id } = req.params;
  try {
    const checkRes = await query('SELECT 1 FROM public.catalogo_paises WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'País no encontrado.' });
    }

    const result = await query(
      'UPDATE public.catalogo_paises SET activo = false WHERE id = $1 RETURNING *',
      [id]
    );
    return res.status(200).json({ message: 'País desactivado correctamente.', data: result.rows[0] });
  } catch (error) {
    next(error);
  }
};
