import { query } from '../db.js';

// Obtener la junta directiva de una empresa
export const getJuntaDirectiva = async (req, res, next) => {
  const { idEmpresa } = req.params;

  try {
    const result = await query(
      `SELECT 
        jd.id_junta_directiva AS id_junta_directiva_usuario,
        jd.id_usuario_juridico AS id_empresa,
        jd.id_miembro,
        u.nombre AS nombre_miembro,
        u.apellidos AS apellidos_miembro,
        u.email AS email_miembro,
        COALESCE(cr.descripcion, jd.id_cargo) AS nombre_rol,
        jd.fecha_registro AS fecha_nombramiento
      FROM public.junta_directiva_usuario jd
      JOIN public.usuarios u ON jd.id_miembro = u."idUsuario"
      LEFT JOIN public.catalogo_rol cr ON jd.id_cargo = CAST(cr.idrol AS VARCHAR)
      WHERE jd.id_usuario_juridico = $1 AND jd.activo = true
      ORDER BY jd.fecha_registro DESC`,
      [idEmpresa]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Agregar un miembro a la junta directiva
export const agregarMiembro = async (req, res, next) => {
  const { id_empresa, id_miembro, id_rol } = req.body;

  try {
    if (!id_empresa || !id_miembro || !id_rol) {
      return res.status(400).json({ message: 'Todos los campos (empresa, miembro y rol) son requeridos.' });
    }

    // Verificar si ya existe este miembro en la junta de esta empresa con el mismo cargo
    const existCheck = await query(
      'SELECT id_junta_directiva FROM public.junta_directiva_usuario WHERE id_usuario_juridico = $1 AND id_miembro = $2 AND id_cargo = $3 AND activo = true',
      [id_empresa, id_miembro, String(id_rol)]
    );

    if (existCheck.rows.length > 0) {
      return res.status(409).json({ message: 'Este miembro ya está registrado con ese rol en esta junta.' });
    }

    // Insertar en la base de datos
    await query(
      `INSERT INTO public.junta_directiva_usuario (
        id_usuario_juridico, id_miembro, id_cargo, fecha_registro, activo
      ) VALUES ($1, $2, $3, CURRENT_DATE, true)`,
      [id_empresa, id_miembro, String(id_rol)]
    );

    return res.status(201).json({ message: 'Miembro agregado a la junta directiva con éxito.' });
  } catch (error) {
    next(error);
  }
};

// Eliminar un miembro de la junta directiva
export const eliminarMiembro = async (req, res, next) => {
  const { idJuntaDirectiva } = req.params;

  try {
    const result = await query(
      'DELETE FROM public.junta_directiva_usuario WHERE id_junta_directiva = $1 RETURNING id_junta_directiva',
      [idJuntaDirectiva]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Registro de junta directiva no encontrado.' });
    }

    return res.status(200).json({ message: 'Miembro removido de la junta directiva.' });
  } catch (error) {
    next(error);
  }
};
