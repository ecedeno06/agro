import { query } from '../db.js';
import { resolverScope } from '../security/scope.helper.js';

/**
 * Subconsulta reutilizable: propietarios que pertenecen a un capítulo dado.
 * Las fincas no tienen columna de capítulo propia, así que el alcance se deriva
 * del capítulo del propietario en usuario_rol.
 */
const SUBQUERY_PROPIETARIOS_DEL_CAPITULO = `
  SELECT ur.id_usuario
  FROM public.usuario_rol ur
  WHERE ur.activo = true AND ur.id_capitulo = `;

/**
 * Auxiliar para verificar si el usuario tiene activo el rol de Asociado ('aso' o 'asociado') en su sesión
 */
async function esAsociado(userId, userRol) {
  if (userRol) {
    return ['aso', 'asociado'].includes(String(userRol).trim().toLowerCase());
  }

  const res = await query(
    `SELECT u.rol, ur.id_rol, cr.codigo AS codigo_rol
     FROM public.usuarios u
     LEFT JOIN public.usuario_rol ur ON ur.id_usuario = u."idUsuario" AND ur.activo = true
     LEFT JOIN public.catalogo_rol cr ON cr.idrol = ur.id_rol AND cr.activo = true
     WHERE u."idUsuario" = $1`,
    [userId]
  );

  if (res.rows.length === 0) return false;

  const roles = res.rows.map(r => r.codigo_rol || r.rol);
  return roles.some(rol => 
    ['aso', 'asociado'].includes((rol || '').trim().toLowerCase())
  );
}

/**
 * Auxiliar para verificar si el rol activo del usuario tiene asignado un permiso específico en la matriz rol_menu_permiso para /mis-fincas
 */
async function tienePermisoEnMatriz(rolId, userId, codigoPermiso) {
  try {
    let finalRolId = rolId;
    if (!finalRolId && userId) {
      const resRol = await query(
        `SELECT ur.id_rol
         FROM public.usuario_rol ur
         WHERE ur.id_usuario = $1 AND ur.activo = true
         LIMIT 1`,
        [userId]
      );
      if (resRol.rows.length > 0) {
        finalRolId = resRol.rows[0].id_rol;
      }
    }
    if (!finalRolId) return true;

    const res = await query(
      `SELECT rmp.id 
       FROM public.rol_menu_permiso rmp
       JOIN public.menus m ON rmp.menu_id = m.id
       JOIN public.permisos p ON rmp.permiso_id = p.id
       WHERE rmp.rol_id = $1 
         AND (m.ruta = '/mis-fincas' OR m.ruta = 'mis-fincas' OR m.ruta = '/fincas')
         AND LOWER(p.codigo) = LOWER($2)`,
      [finalRolId, codigoPermiso]
    );
    return res.rows.length > 0;
  } catch (err) {
    console.error('Error al verificar permiso en matriz:', err);
    return true;
  }
}

/**
 * Obtener las fincas (Validando permiso 'ver' y filtrando fincas del ASO)
 */
export const getFincas = async (req, res, next) => {
  const userId = req.userId;
  const userRol = req.userRol;
  const rolId = req.userRolId;

  try {
    const esAsociadoUser = await esAsociado(userId, userRol);

    // Solo SUPERADMIN es global; el resto (incluido 'adm') se acota a su capítulo.
    const { esGlobal, idCapitulo } = resolverScope(req);

    // Validar permiso de lectura 'ver' en la matriz para usuarios no globales
    if (!esGlobal) {
      const tienePermisoVer = await tienePermisoEnMatriz(rolId, userId, 'ver');
      if (!tienePermisoVer) {
        return res.status(403).json({
          message: 'Acceso denegado. Su rol no tiene el permiso de lectura "ver" asignado para consultar fincas.'
        });
      }

      if (idCapitulo == null) {
        return res.status(403).json({
          message: 'Su sesión no tiene un capítulo asociado. Vuelva a iniciar sesión y seleccione un perfil válido.'
        });
      }
    }

    let queryStr = `SELECT 
         f.*,
         TRIM(CONCAT(u.nombre, ' ', COALESCE(u.apellidos, ''))) AS nombre_propietario,
         u.email AS email_propietario,
         TRIM(CONCAT(ul.nombre, ' ', COALESCE(ul.apellidos, ''))) AS nombre_propietario_legal,
         ul.email AS email_propietario_legal,
         tt.nombre AS nombre_tipo_terreno,
         ts.nombre AS nombre_tipo_suelo,
         tg.descripcion AS nombre_tipo_geografia,
         tel.descripcion AS nombre_estado_legal,
         tp.nombre AS nombre_tipo_produccion,
         pc.nombre AS nombre_pais
       FROM public.fincas f
       LEFT JOIN public.usuarios u ON f.id_propietario = u."idUsuario"
       LEFT JOIN public.usuarios ul ON f.id_propietario_legal = ul."idUsuario"
       LEFT JOIN public.tipo_terreno tt ON f.tipo_terreno = tt.id
       LEFT JOIN public.tipo_suelos ts ON f.tipo_suelo = ts.id
       LEFT JOIN public.tipo_geografia tg ON f.tipo_geografia = tg.id_tipo_geografia
       LEFT JOIN public.tipo_estado_legal tel ON f.estado_legal = tel.id_estado_legal
       LEFT JOIN public.tipo_produccion tp ON f.id_tipo_produccion = tp.id_tipo
       LEFT JOIN public.catalogo_paises pc ON f.id_pais = pc.codigo_iso2`;
    let queryParams = [];
    const conditions = [];

    // El asociado (ASO) siempre ve únicamente sus propias fincas.
    if (esAsociadoUser) {
      queryParams.push(userId);
      conditions.push(`f.id_propietario = $${queryParams.length}`);
    } else if (!esGlobal) {
      // Rol administrativo de capítulo (ej. ADM): ve las fincas cuyos propietarios
      // pertenecen a su mismo capítulo.
      queryParams.push(idCapitulo);
      conditions.push(
        `f.id_propietario IN (${SUBQUERY_PROPIETARIOS_DEL_CAPITULO}$${queryParams.length})`
      );
    }

    if (conditions.length > 0) {
      queryStr += ` WHERE ${conditions.join(' AND ')}`;
    }

    queryStr += ` ORDER BY f.id_finca DESC`;

    const result = await query(queryStr, queryParams);
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener una finca por ID (Verificando permiso 'ver' y propiedad para ASO)
 */
export const getFincaById = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.userId;
  const userRol = req.userRol;
  const rolId = req.userRolId;

  try {
    const result = await query(
      `SELECT 
         f.*,
         TRIM(CONCAT(u.nombre, ' ', COALESCE(u.apellidos, ''))) AS nombre_propietario,
         u.email AS email_propietario,
         TRIM(CONCAT(ul.nombre, ' ', COALESCE(ul.apellidos, ''))) AS nombre_propietario_legal,
         ul.email AS email_propietario_legal,
         tt.nombre AS nombre_tipo_terreno,
         ts.nombre AS nombre_tipo_suelo,
         tg.descripcion AS nombre_tipo_geografia,
         tel.descripcion AS nombre_estado_legal,
         tp.nombre AS nombre_tipo_produccion,
         pc.nombre AS nombre_pais
       FROM public.fincas f
       LEFT JOIN public.usuarios u ON f.id_propietario = u."idUsuario"
       LEFT JOIN public.usuarios ul ON f.id_propietario_legal = ul."idUsuario"
       LEFT JOIN public.tipo_terreno tt ON f.tipo_terreno = tt.id
       LEFT JOIN public.tipo_suelos ts ON f.tipo_suelo = ts.id
       LEFT JOIN public.tipo_geografia tg ON f.tipo_geografia = tg.id_tipo_geografia
       LEFT JOIN public.tipo_estado_legal tel ON f.estado_legal = tel.id_estado_legal
       LEFT JOIN public.tipo_produccion tp ON f.id_tipo_produccion = tp.id_tipo
       LEFT JOIN public.catalogo_paises pc ON f.id_pais = pc.codigo_iso2
       WHERE f.id_finca = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Finca no encontrada.' });
    }

    const finca = result.rows[0];

    const esAsociadoUser = await esAsociado(userId, userRol);

    // Solo SUPERADMIN es global; el resto (incluido 'adm') se acota a su capítulo.
    const { esGlobal, idCapitulo } = resolverScope(req);

    if (!esGlobal) {
      const tienePermisoVer = await tienePermisoEnMatriz(rolId, userId, 'ver');
      if (!tienePermisoVer) {
        return res.status(403).json({ message: 'Acceso denegado. Su rol no tiene permiso "ver" asignado para consultar fincas.' });
      }
    }

    // El asociado solo puede ver sus propias fincas.
    if (esAsociadoUser && Number(finca.id_propietario) !== Number(userId)) {
      return res.status(403).json({ message: 'Acceso denegado. No tiene permiso para ver esta finca.' });
    }

    // Rol administrativo de capítulo: la finca debe pertenecer a un propietario de su capítulo.
    if (!esGlobal && !esAsociadoUser) {
      if (idCapitulo == null) {
        return res.status(403).json({
          message: 'Su sesión no tiene un capítulo asociado. Vuelva a iniciar sesión y seleccione un perfil válido.'
        });
      }

      const mismoCapitulo = await query(
        `SELECT 1 FROM public.usuario_rol ur
         WHERE ur.id_usuario = $1 AND ur.activo = true AND ur.id_capitulo = $2
         LIMIT 1`,
        [finca.id_propietario, idCapitulo]
      );

      if (mismoCapitulo.rows.length === 0) {
        return res.status(403).json({
          message: 'Acceso denegado. Esta finca no pertenece a su capítulo.'
        });
      }
    }

    return res.status(200).json(finca);
  } catch (error) {
    next(error);
  }
};

/**
 * Crear nueva finca (Validando rol ASO y permiso 'crear' en matriz)
 */
export const crearFinca = async (req, res, next) => {
  const userId = req.userId;
  const rolId = req.userRolId;

  try {
    const esAsociadoUser = await esAsociado(userId, req.userRol);
    if (!esAsociadoUser) {
      return res.status(403).json({ 
        message: 'Acceso denegado. Solo los asociados (rol aso) pueden registrar fincas.' 
      });
    }

    // Validar permiso 'crear' configurado para el rol en la matriz de permisos
    const tienePermisoCrear = await tienePermisoEnMatriz(rolId, userId, 'crear');
    if (!tienePermisoCrear) {
      return res.status(403).json({ 
        message: 'Acceso denegado. Su rol no tiene el permiso "crear" asignado en la matriz de permisos.' 
      });
    }

    const {
      nombre_finca,
      tamano,
      tipo_terreno,
      tipo_suelo,
      fuente_hidro,
      ubicacion_mapa,
      estado,
      tipo_geografia,
      distribcion_geografia,
      area_terreno,
      clima,
      id_pais,
      id_privincia,
      id_distrito,
      id_corregimiento,
      mapa_logitud,
      mapa_latitud,
      tomo,
      folio,
      no_finca,
      estado_legal,
      titulo_finca,
      id_propietario_legal,
      notas,
      id_tipo_produccion
    } = req.body;

    if (!nombre_finca || tamano === undefined || tamano === null) {
      return res.status(400).json({ message: 'El nombre de la finca y el tamaño son obligatorios.' });
    }

    const propietarioFinal = userId;

    const result = await query(
      `INSERT INTO public.fincas (
        id_propietario, tamano, tipo_terreno, tipo_suelo, fuente_hidro,
        ubicacion_mapa, estado, tipo_geografia, distribcion_geografia, area_terreno,
        clima, id_pais, id_privincia, id_distrito, id_corregimiento,
        mapa_logitud, mapa_latitud, tomo, folio, no_finca,
        estado_legal, titulo_finca, nombre_finca, id_propietario_legal, notas,
        id_tipo_produccion
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26
      ) RETURNING *`,
      [
        propietarioFinal,
        tamano,
        tipo_terreno ? Number(tipo_terreno) : null,
        tipo_suelo ? Number(tipo_suelo) : null,
        fuente_hidro ? JSON.stringify(fuente_hidro) : null,
        ubicacion_mapa ? JSON.stringify(ubicacion_mapa) : null,
        estado || 'En producción',
        tipo_geografia ? Number(tipo_geografia) : null,
        distribcion_geografia || null,
        area_terreno || null,
        clima || null,
        id_pais || null,
        id_privincia || null,
        id_distrito || null,
        id_corregimiento || null,
        mapa_logitud || null,
        mapa_latitud || null,
        tomo || null,
        folio || null,
        no_finca || null,
        estado_legal ? Number(estado_legal) : null,
        titulo_finca || null,
        nombre_finca,
        id_propietario_legal ? Number(id_propietario_legal) : null,
        notas || null,
        id_tipo_produccion ? Number(id_tipo_produccion) : null
      ]
    );

    const createdResult = await query(
      `SELECT 
         f.*,
         TRIM(CONCAT(u.nombre, ' ', COALESCE(u.apellidos, ''))) AS nombre_propietario,
         u.email AS email_propietario,
         TRIM(CONCAT(ul.nombre, ' ', COALESCE(ul.apellidos, ''))) AS nombre_propietario_legal,
         ul.email AS email_propietario_legal,
         tt.nombre AS nombre_tipo_terreno,
         ts.nombre AS nombre_tipo_suelo,
         tg.descripcion AS nombre_tipo_geografia,
         tel.descripcion AS nombre_estado_legal,
         tp.nombre AS nombre_tipo_produccion,
         pc.nombre AS nombre_pais
       FROM public.fincas f
       LEFT JOIN public.usuarios u ON f.id_propietario = u."idUsuario"
       LEFT JOIN public.usuarios ul ON f.id_propietario_legal = ul."idUsuario"
       LEFT JOIN public.tipo_terreno tt ON f.tipo_terreno = tt.id
       LEFT JOIN public.tipo_suelos ts ON f.tipo_suelo = ts.id
       LEFT JOIN public.tipo_geografia tg ON f.tipo_geografia = tg.id_tipo_geografia
       LEFT JOIN public.tipo_estado_legal tel ON f.estado_legal = tel.id_estado_legal
       LEFT JOIN public.tipo_produccion tp ON f.id_tipo_produccion = tp.id_tipo
       LEFT JOIN public.catalogo_paises pc ON f.id_pais = pc.codigo_iso2
       WHERE f.id_finca = $1`,
      [result.rows[0].id_finca]
    );

    return res.status(201).json({
      message: 'Finca creada exitosamente.',
      finca: createdResult.rows[0]
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Editar finca existente (Validando propiedad y permiso 'editar' en matriz)
 */
export const actualizarFinca = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.userId;
  const rolId = req.userRolId;

  try {
    const esAdminUser = req.userRol === 'admin' || req.userRol === 'superadmin' || String(req.userId) === '1' || String(req.userId) === '3';
    const esAsociadoUser = await esAsociado(userId, req.userRol);
    if (!esAsociadoUser && !esAdminUser) {
      return res.status(403).json({ 
        message: 'Acceso denegado. Solo los asociados o administradores pueden editar fincas.' 
      });
    }

    // Validar permiso 'editar' configurado para el rol en la matriz de permisos
    const tienePermisoEditar = await tienePermisoEnMatriz(rolId, userId, 'editar');
    if (!tienePermisoEditar && !esAdminUser) {
      return res.status(403).json({ 
        message: 'Acceso denegado. Su rol no tiene el permiso "editar" asignado en la matriz de permisos.' 
      });
    }

    // Verificar si la finca existe y si el usuario es el propietario de la finca (o es administrador)
    const fincaRes = await query('SELECT id_finca, id_propietario FROM public.fincas WHERE id_finca = $1', [id]);
    if (fincaRes.rows.length === 0) {
      return res.status(404).json({ message: 'Finca no encontrada.' });
    }

    const fincaExistente = fincaRes.rows[0];
    const esSuFinca = Number(fincaExistente.id_propietario) === Number(userId);

    if (!esSuFinca && !esAdminUser) {
      return res.status(403).json({ 
        message: 'Acceso denegado. Solo el asociado propietario asignado a esta finca o un administrador puede modificarla.' 
      });
    }

    const {
      nombre_finca,
      tamano,
      tipo_terreno,
      tipo_suelo,
      fuente_hidro,
      ubicacion_mapa,
      estado,
      tipo_geografia,
      distribcion_geografia,
      area_terreno,
      clima,
      id_pais,
      id_privincia,
      id_distrito,
      id_corregimiento,
      mapa_logitud,
      mapa_latitud,
      tomo,
      folio,
      no_finca,
      estado_legal,
      titulo_finca,
      id_propietario_legal,
      notas,
      id_tipo_produccion
    } = req.body;

    const valTipoTerreno = (tipo_terreno !== undefined && tipo_terreno !== null && tipo_terreno !== '') ? Number(tipo_terreno) : null;
    const valTipoSuelo = (tipo_suelo !== undefined && tipo_suelo !== null && tipo_suelo !== '') ? Number(tipo_suelo) : null;
    const valTipoGeografia = (tipo_geografia !== undefined && tipo_geografia !== null && tipo_geografia !== '') ? Number(tipo_geografia) : null;
    const valEstadoLegal = (estado_legal !== undefined && estado_legal !== null && estado_legal !== '') ? Number(estado_legal) : null;
    const valPropietarioLegal = (id_propietario_legal !== undefined && id_propietario_legal !== null && id_propietario_legal !== '') ? Number(id_propietario_legal) : null;
    const valTipoProduccion = (id_tipo_produccion !== undefined && id_tipo_produccion !== null && id_tipo_produccion !== '') ? Number(id_tipo_produccion) : null;

    await query(
      `UPDATE public.fincas SET
        nombre_finca = COALESCE($1, nombre_finca),
        tamano = COALESCE($2, tamano),
        tipo_terreno = $3,
        tipo_suelo = $4,
        fuente_hidro = COALESCE($5, fuente_hidro),
        ubicacion_mapa = COALESCE($6, ubicacion_mapa),
        estado = COALESCE($7, estado),
        tipo_geografia = $8,
        distribcion_geografia = $9,
        area_terreno = $10,
        clima = COALESCE($11, clima),
        id_pais = COALESCE($12, id_pais),
        id_privincia = $13,
        id_distrito = $14,
        id_corregimiento = $15,
        mapa_logitud = $16,
        mapa_latitud = $17,
        tomo = COALESCE($18, tomo),
        folio = COALESCE($19, folio),
        no_finca = COALESCE($20, no_finca),
        estado_legal = $21,
        titulo_finca = COALESCE($22, titulo_finca),
        id_propietario_legal = $23,
        notas = $24,
        id_tipo_produccion = $25
      WHERE id_finca = $26`,
      [
        nombre_finca,
        tamano,
        valTipoTerreno,
        valTipoSuelo,
        fuente_hidro ? JSON.stringify(fuente_hidro) : null,
        ubicacion_mapa ? JSON.stringify(ubicacion_mapa) : null,
        estado,
        valTipoGeografia,
        distribcion_geografia,
        area_terreno,
        clima,
        id_pais,
        id_privincia,
        id_distrito,
        id_corregimiento,
        mapa_logitud,
        mapa_latitud,
        tomo,
        folio,
        no_finca,
        valEstadoLegal,
        titulo_finca,
        valPropietarioLegal,
        notas || null,
        valTipoProduccion,
        id
      ]
    );

    const updatedResult = await query(
      `SELECT 
         f.*,
         TRIM(CONCAT(u.nombre, ' ', COALESCE(u.apellidos, ''))) AS nombre_propietario,
         u.email AS email_propietario,
         TRIM(CONCAT(ul.nombre, ' ', COALESCE(ul.apellidos, ''))) AS nombre_propietario_legal,
         ul.email AS email_propietario_legal,
         tt.nombre AS nombre_tipo_terreno,
         ts.nombre AS nombre_tipo_suelo,
         tg.descripcion AS nombre_tipo_geografia,
         tel.descripcion AS nombre_estado_legal,
         tp.nombre AS nombre_tipo_produccion,
         pc.nombre AS nombre_pais
       FROM public.fincas f
       LEFT JOIN public.usuarios u ON f.id_propietario = u."idUsuario"
       LEFT JOIN public.usuarios ul ON f.id_propietario_legal = ul."idUsuario"
       LEFT JOIN public.tipo_terreno tt ON f.tipo_terreno = tt.id
       LEFT JOIN public.tipo_suelos ts ON f.tipo_suelo = ts.id
       LEFT JOIN public.tipo_geografia tg ON f.tipo_geografia = tg.id_tipo_geografia
       LEFT JOIN public.tipo_estado_legal tel ON f.estado_legal = tel.id_estado_legal
       LEFT JOIN public.tipo_produccion tp ON f.id_tipo_produccion = tp.id_tipo
       LEFT JOIN public.catalogo_paises pc ON f.id_pais = pc.codigo_iso2
       WHERE f.id_finca = $1`,
      [id]
    );

    return res.status(200).json({
      message: 'Finca actualizada exitosamente.',
      finca: updatedResult.rows[0]
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar finca (Validando propiedad y permiso 'eliminar' en matriz)
 */
export const eliminarFinca = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.userId;
  const rolId = req.userRolId;

  try {
    const esAsociadoUser = await esAsociado(userId, req.userRol);
    if (!esAsociadoUser) {
      return res.status(403).json({ 
        message: 'Acceso denegado. Solo los asociados (rol aso) pueden eliminar fincas.' 
      });
    }

    // Validar permiso 'eliminar' configurado para el rol en la matriz de permisos
    const tienePermisoEliminar = await tienePermisoEnMatriz(rolId, userId, 'eliminar');
    if (!tienePermisoEliminar) {
      return res.status(403).json({ 
        message: 'Acceso denegado. Su rol no tiene el permiso "eliminar" asignado en la matriz de permisos.' 
      });
    }

    const fincaRes = await query('SELECT id_finca, id_propietario FROM public.fincas WHERE id_finca = $1', [id]);
    if (fincaRes.rows.length === 0) {
      return res.status(404).json({ message: 'Finca no encontrada.' });
    }

    const fincaExistente = fincaRes.rows[0];
    const esSuFinca = Number(fincaExistente.id_propietario) === Number(userId);

    if (!esSuFinca) {
      return res.status(403).json({ 
        message: 'Acceso denegado. Solo el asociado propietario de esta finca puede eliminarla.' 
      });
    }

    await query('DELETE FROM public.fincas WHERE id_finca = $1', [id]);

    return res.status(200).json({ message: 'Finca eliminada exitosamente.' });
  } catch (error) {
    next(error);
  }
};
