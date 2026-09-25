import bcrypt from 'bcrypt';
import { query, withTransaction } from '../db.js';
import { resolverScope, puedeAccederCapitulo } from '../security/scope.helper.js';
import { resolverRol } from '../security/rol.helper.js';

export const getUsuarios = async (req, res, next) => {
  try {
    const { esGlobal, idCapitulo } = resolverScope(req);

    // Rol no global sin capítulo en sesión: no puede listar usuarios.
    if (!esGlobal && idCapitulo == null) {
      return res.status(403).json({
        message: 'Su sesión no tiene un capítulo asociado. Vuelva a iniciar sesión y seleccione un perfil válido.'
      });
    }

    // Filtro de capítulo: NULL para SUPERADMIN (ve todo), el capítulo de la
    // sesión para cualquier otro rol.
    const filtroCapitulo = esGlobal ? null : idCapitulo;

    // El rol mostrado proviene de catalogo_rol a través de usuario_rol (la relación
    // real), NO de la columna heredada usuarios.rol, que solo queda como respaldo
    // para usuarios que aún no tienen ninguna asignación en usuario_rol.
    const result = await query(
      `SELECT
         u."idUsuario", u.nombre, u.apellidos, u.email, u.telefono, u.activo,
         u.tipo_persona, u.dni, u.ruc, u.no_aviso_operacion, u.fecha_aviso_operacion,
         u.rep_legal, u.fecha_creacion,
         COALESCE(r.roles_codigos, u.rol)      AS rol,
         COALESCE(r.roles, '[]'::json)         AS roles,
         u.rol                                 AS rol_legacy
       FROM public.usuarios u
       LEFT JOIN LATERAL (
         SELECT
           string_agg(DISTINCT cr.codigo, ', ' ORDER BY cr.codigo) AS roles_codigos,
           json_agg(json_build_object(
             'idRol', cr.idrol,
             'codigo', cr.codigo,
             'descripcion', cr.descripcion,
             'idCapitulo', ur.id_capitulo,
             'nombreCapitulo', c.nombre_capitulo
           ) ORDER BY cr.codigo) AS roles
         FROM public.usuario_rol ur
         JOIN public.catalogo_rol cr ON cr.idrol = ur.id_rol AND cr.activo = true
         LEFT JOIN public.capitulo c ON c.id_capitulo = ur.id_capitulo
         WHERE ur.id_usuario = u."idUsuario"
           AND ur.activo = true
           AND ($1::int IS NULL OR ur.id_capitulo = $1::int)
       ) r ON true
       WHERE $1::int IS NULL OR EXISTS (
         SELECT 1 FROM public.usuario_rol ur2
         WHERE ur2.id_usuario = u."idUsuario"
           AND ur2.activo = true
           AND ur2.id_capitulo = $1::int
       )
       ORDER BY u."idUsuario" ASC`,
      [filtroCapitulo]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const crearUsuario = async (req, res, next) => {
  const {
    nombre,
    apellidos,
    email,
    password,
    telefono,
    rol,
    idRol,
    idCapitulo,
    tipo_persona,
    dni,
    ruc,
    no_aviso_operacion,
    fecha_aviso_operacion,
    rep_legal
  } = req.body;

  try {
    if (!nombre || !email) {
      return res.status(400).json({ message: 'Nombre y correo electrónico son obligatorios.' });
    }

    const { esGlobal, idCapitulo: capituloSesion } = resolverScope(req);

    // El rol se resuelve SIEMPRE contra catalogo_rol (admite idRol o código legacy).
    const rolCatalogo = await resolverRol({ idRol, codigo: rol || 'operario' });
    if (!rolCatalogo) {
      return res.status(400).json({
        message: `El rol indicado no existe o está inactivo en el catálogo de roles.`
      });
    }

    // 'superadmin' no se otorga por esta vía: solo el proceso de
    // aprovisionamiento firmado (scripts/provision-superuser.js) crea una
    // identidad SUPERADMIN real. Asignarlo aquí solo dejaría una fila en
    // usuario_rol sin firma, que esSuperadmin() de todas formas rechazaría.
    if (rolCatalogo.codigo === 'superadmin') {
      return res.status(400).json({
        message: 'El rol SUPERADMIN no se puede asignar desde aquí. Requiere el proceso de aprovisionamiento firmado.'
      });
    }

    // Capítulo destino: un rol no global solo puede crear dentro del suyo.
    let capituloDestino;
    if (esGlobal) {
      capituloDestino = idCapitulo != null ? Number(idCapitulo) : null;
    } else {
      if (capituloSesion == null) {
        return res.status(403).json({
          message: 'Su sesión no tiene un capítulo asociado. No puede crear usuarios.'
        });
      }
      if (idCapitulo != null && !puedeAccederCapitulo(req, idCapitulo)) {
        return res.status(403).json({
          message: 'No puede crear usuarios en un capítulo distinto al suyo.'
        });
      }
      capituloDestino = capituloSesion;
    }

    // Verificar si el correo ya está registrado
    const checkEmail = await query('SELECT email FROM usuarios WHERE email = $1', [email]);
    if (checkEmail.rows.length > 0) {
      return res.status(409).json({ message: 'El correo electrónico ya está registrado.' });
    }

    // Si viene password (usuario interactivo), se encripta. Si no, se genera un hash aleatorio de un valor placeholder (para satisfacer NOT NULL) y queda inactivo
    let hashedPassword = '';
    let activo = true;
    let debeCambiarPassword = false;

    if (password && password.trim().length > 0) {
      const saltRounds = 10;
      hashedPassword = await bcrypt.hash(password, saltRounds);
      activo = true;
      debeCambiarPassword = true;
    } else {
      // Usuario creado solo para Junta Directiva (sin acceso interactivo inicial)
      const randomPlaceholder = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const saltRounds = 10;
      hashedPassword = await bcrypt.hash(randomPlaceholder, saltRounds);
      activo = false;
      debeCambiarPassword = true;
    }

    // Usuario y asignación de rol se crean de forma atómica: si falla el rol,
    // no queda un usuario huérfano sin relación en usuario_rol.
    const usuarioCreado = await withTransaction(async (tx) => {
      const result = await tx(
        `INSERT INTO public.usuarios (
          nombre, apellidos, email, password, telefono, rol,
          tipo_persona, dni, ruc, no_aviso_operacion, fecha_aviso_operacion, rep_legal, activo, debe_cambiar_password
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING "idUsuario", nombre, apellidos, email, rol, telefono, tipo_persona, dni, ruc, activo`,
        [
          nombre,
          apellidos || null,
          email,
          hashedPassword,
          telefono || null,
          // Se mantiene sincronizada con el catálogo por compatibilidad, pero la
          // fuente de verdad del rol es usuario_rol.
          rolCatalogo.codigo,
          tipo_persona || 'natural',
          dni || null,
          ruc || null,
          no_aviso_operacion || null,
          fecha_aviso_operacion || null,
          rep_legal ? Number(rep_legal) : null,
          activo,
          debeCambiarPassword
        ]
      );

      const nuevoUsuario = result.rows[0];

      // La asignación se registra siempre (antes solo ocurría para usuarios con
      // contraseña creados por no-superadmin, dejando al resto sin rol real).
      await tx(
        `INSERT INTO public.usuario_rol (id_capitulo, id_usuario, id_rol, fecha_creacion, expira, activo, creado_por)
         VALUES ($1, $2, $3, CURRENT_DATE, false, true, $4)`,
        [capituloDestino, nuevoUsuario.idUsuario, rolCatalogo.idrol, req.userId || null]
      );

      return nuevoUsuario;
    });

    return res.status(201).json({
      message: 'Usuario registrado exitosamente.',
      usuario: {
        ...usuarioCreado,
        idRol: rolCatalogo.idrol,
        rolDescripcion: rolCatalogo.descripcion,
        idCapitulo: capituloDestino
      }
    });
  } catch (error) {
    next(error);
  }
};

function calcularDistanciaLevenshtein(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  const matriz = [];
  for (let i = 0; i <= s2.length; i++) matriz[i] = [i];
  for (let j = 0; j <= s1.length; j++) matriz[0][j] = j;

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matriz[i][j] = matriz[i - 1][j - 1];
      } else {
        matriz[i][j] = Math.min(
          matriz[i - 1][j - 1] + 1, // Sustitución
          matriz[i][j - 1] + 1,     // Inserción
          matriz[i - 1][j] + 1      // Eliminación
        );
      }
    }
  }
  return matriz[s2.length][s1.length];
}

export const cambiarPassword = async (req, res, next) => {
  const { passwordActual, nuevoPassword, pista } = req.body;

  try {
    if (!passwordActual || !nuevoPassword) {
      return res.status(400).json({ message: 'La contraseña actual y la nueva contraseña son obligatorias.' });
    }

    // Obtener al usuario (req.userId viene del authMiddleware de base de datos)
    const result = await query(
      'SELECT password FROM usuarios WHERE "idUsuario" = $1 AND activo = true',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const usuario = result.rows[0];

    // Verificar la contraseña actual
    const match = await bcrypt.compare(passwordActual, usuario.password);
    if (!match) {
      return res.status(400).json({ message: 'La contraseña actual ingresada es incorrecta.' });
    }

    // Validar similitud si se proporciona una pista
    const pst = (pista || '').trim();
    if (pst) {
      const maxSimilitud = parseInt(process.env.PASSWORD_HINT_MAX_SIMILARITY || '70', 10);
      const distancia = calcularDistanciaLevenshtein(nuevoPassword, pst);
      const longitudMaxima = Math.max(nuevoPassword.length, pst.length);
      const similitud = (1 - (distancia / longitudMaxima)) * 100;

      if (similitud > maxSimilitud) {
        return res.status(400).json({
          message: `La pista es demasiado obvia (${similitud.toFixed(0)}% de similitud). Por seguridad, la pista no debe parecerse a la contraseña más de un ${maxSimilitud}%.`
        });
      }
    }

    // Encriptar la nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(nuevoPassword, saltRounds);

    // Actualizar la contraseña, la pista y marcar que ya no debe cambiarla
    await query(
      'UPDATE usuarios SET password = $1, pista = $2, debe_cambiar_password = false WHERE "idUsuario" = $3',
      [hashedPassword, pst || null, req.userId]
    );

    return res.status(200).json({ message: 'Contraseña actualizada exitosamente.' });

  } catch (error) {
    next(error);
  }
};

export const generarPassword = async (req, res, next) => {
  try {
    const length = parseInt(process.env.PASSWORD_LENGTH || '12', 10);
    const requireSpecial = process.env.PASSWORD_REQUIRE_SPECIAL === 'true';
    const requireUpper = process.env.PASSWORD_REQUIRE_UPPERCASE === 'true';
    const requireNumbers = process.env.PASSWORD_REQUIRE_NUMBERS === 'true';

    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+~|}{[]:;?><,./-=';

    let pool = lowercase;
    let password = '';

    // Garantizar al menos uno de cada tipo requerido
    if (requireUpper) {
      pool += uppercase;
      password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    }
    if (requireNumbers) {
      pool += numbers;
      password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    if (requireSpecial) {
      pool += special;
      password += special.charAt(Math.floor(Math.random() * special.length));
    }
    // Siempre al menos una minúscula
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));

    // Completar el resto hasta el largo deseado
    const remainingLength = length - password.length;
    for (let i = 0; i < remainingLength; i++) {
      password += pool.charAt(Math.floor(Math.random() * pool.length));
    }

    // Mezclar el password final para que los caracteres requeridos no queden siempre al inicio
    const passwordArray = password.split('');
    for (let i = passwordArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }

    return res.status(200).json({ password: passwordArray.join('') });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener los roles asignados a un usuario específico
 */
export const getRolesUsuario = async (req, res, next) => {
  const { id } = req.params;
  try {
    const { esGlobal, idCapitulo } = resolverScope(req);

    if (!esGlobal && idCapitulo == null) {
      return res.status(403).json({
        message: 'Su sesión no tiene un capítulo asociado. Vuelva a iniciar sesión y seleccione un perfil válido.'
      });
    }

    // Un rol no global solo ve las asignaciones de su propio capítulo.
    const result = await query(
      `SELECT
         ur.id_registro AS "idRegistro",
         ur.id_usuario AS "idUsuario",
         ur.id_rol AS "idRol",
         ur.id_capitulo AS "idCapitulo",
         c.nombre_capitulo AS "nombreCapitulo",
         ur.activo,
         ur.fecha_creacion AS "fechaCreacion",
         cr.codigo,
         cr.descripcion
       FROM public.usuario_rol ur
       JOIN public.catalogo_rol cr ON ur.id_rol = cr.idrol
       LEFT JOIN public.capitulo c ON c.id_capitulo = ur.id_capitulo
       WHERE ur.id_usuario = $1
         AND ($2::int IS NULL OR ur.id_capitulo = $2::int)
       ORDER BY ur.id_registro ASC`,
      [id, esGlobal ? null : idCapitulo]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener catálogo completo de roles
 */
export const getCatalogoRoles = async (req, res, next) => {
  try {
    // 'superadmin' se excluye a propósito: no es un rol elegible desde esta
    // lista. Otorgarlo requiere el proceso de aprovisionamiento firmado
    // (scripts/provision-superuser.js), no una simple asignación en
    // usuario_rol (ver Fase 1, regla 10).
    const result = await query(
      `SELECT idrol AS "idRol", idrol, codigo, descripcion, activo
       FROM public.catalogo_rol
       WHERE (activo = true OR activo IS NULL)
         AND codigo <> 'superadmin'
       ORDER BY idrol ASC`
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Asignar un rol a un usuario
 */
export const asignarRolUsuario = async (req, res, next) => {
  const { id } = req.params;
  const { idRol, idCapitulo } = req.body;

  if (!idRol) {
    return res.status(400).json({ message: 'El ID del rol es obligatorio.' });
  }

  try {
    const { esGlobal, idCapitulo: capituloSesion } = resolverScope(req);

    // Un rol no global solo puede asignar roles dentro de su propio capítulo.
    // Si no envía capítulo, se fuerza el de su sesión (no puede elegir otro).
    const capituloDestino = esGlobal
      ? (idCapitulo != null ? Number(idCapitulo) : null)
      : capituloSesion;

    if (!esGlobal) {
      if (capituloSesion == null) {
        return res.status(403).json({
          message: 'Su sesión no tiene un capítulo asociado. No puede asignar roles.'
        });
      }
      if (idCapitulo && !puedeAccederCapitulo(req, idCapitulo)) {
        return res.status(403).json({
          message: 'No puede asignar roles en un capítulo distinto al suyo.'
        });
      }
    }

    // Validar que el rol exista y esté activo en el catálogo
    const rolCatalogo = await resolverRol({ idRol });
    if (!rolCatalogo) {
      return res.status(400).json({ message: 'El rol indicado no existe o está inactivo en el catálogo de roles.' });
    }

    // 'superadmin' no se otorga por esta vía (ver crearUsuario más arriba).
    if (rolCatalogo.codigo === 'superadmin') {
      return res.status(400).json({
        message: 'El rol SUPERADMIN no se puede asignar desde aquí. Requiere el proceso de aprovisionamiento firmado.'
      });
    }

    // La duplicidad se evalúa por (usuario, rol, capítulo): el mismo rol en otro
    // capítulo es una asignación distinta y válida.
    const checkRes = await query(
      `SELECT id_registro, activo FROM public.usuario_rol
       WHERE id_usuario = $1 AND id_rol = $2 AND id_capitulo IS NOT DISTINCT FROM $3`,
      [id, rolCatalogo.idrol, capituloDestino]
    );

    if (checkRes.rows.length > 0) {
      const existente = checkRes.rows[0];
      if (existente.activo) {
        return res.status(409).json({ message: 'El usuario ya tiene este rol asignado en este capítulo.' });
      }
      await query(
        `UPDATE public.usuario_rol SET activo = true WHERE id_registro = $1`,
        [existente.id_registro]
      );
      return res.status(200).json({ message: 'El rol fue reasignado y activado para el usuario.' });
    }

    await query(
      `INSERT INTO public.usuario_rol (id_usuario, id_rol, id_capitulo, activo, fecha_creacion, creado_por)
       VALUES ($1, $2, $3, true, CURRENT_DATE, $4)`,
      [id, rolCatalogo.idrol, capituloDestino, req.userId || null]
    );

    return res.status(201).json({ message: 'Rol asignado exitosamente al usuario.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Alternar estado Activo / Inactivo del rol asignado a un usuario
 */
export const toggleEstadoRolUsuario = async (req, res, next) => {
  const { idRegistro } = req.params;
  try {
    const checkRes = await query('SELECT id_registro, activo, id_capitulo FROM public.usuario_rol WHERE id_registro = $1', [idRegistro]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Asignación de rol no encontrada.' });
    }

    // Un rol no global no puede tocar asignaciones de otro capítulo.
    if (!puedeAccederCapitulo(req, checkRes.rows[0].id_capitulo)) {
      return res.status(403).json({
        message: 'No puede modificar asignaciones de rol de un capítulo distinto al suyo.'
      });
    }

    const nuevoEstado = !checkRes.rows[0].activo;
    await query('UPDATE public.usuario_rol SET activo = $1 WHERE id_registro = $2', [nuevoEstado, idRegistro]);

    return res.status(200).json({
      message: `Rol ${nuevoEstado ? 'activado' : 'desactivado'} para el usuario.`,
      activo: nuevoEstado
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar una asignación de rol de usuario
 */
export const eliminarRolUsuario = async (req, res, next) => {
  const { idRegistro } = req.params;
  try {
    const checkRes = await query('SELECT id_registro, id_capitulo FROM public.usuario_rol WHERE id_registro = $1', [idRegistro]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ message: 'Asignación de rol no encontrada.' });
    }

    // Un rol no global no puede eliminar asignaciones de otro capítulo.
    if (!puedeAccederCapitulo(req, checkRes.rows[0].id_capitulo)) {
      return res.status(403).json({
        message: 'No puede eliminar asignaciones de rol de un capítulo distinto al suyo.'
      });
    }

    await query('DELETE FROM public.usuario_rol WHERE id_registro = $1', [idRegistro]);

    return res.status(200).json({ message: 'Rol removido del usuario exitosamente.' });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar los datos de contacto/personales del usuario autenticado.
 * No permite tocar email, contraseña ni rol (eso pasa por otros flujos).
 */
export const actualizarPerfilPropio = async (req, res, next) => {
  const { nombre, telefono, direccion, ocupacion, fecha_nacimiento, tipo_sangre, tipo_persona, dni } = req.body;
  const userId = req.userId;

  try {
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }

    const result = await query(
      `UPDATE public.usuarios SET
         nombre = $1,
         telefono = $2,
         direccion = $3,
         ocupacion = $4,
         fecha_nacimiento = $5,
         tipo_sangre = $6,
         tipo_persona = $7,
         dni = $8
       WHERE "idUsuario" = $9
       RETURNING "idUsuario", nombre, email, rol, telefono, direccion, ocupacion,
                 fecha_nacimiento, tipo_sangre, tipo_persona, dni, activo,
                 debe_cambiar_password, two_factor_enabled, avatar`,
      [
        nombre.trim(),
        telefono || null,
        JSON.stringify(direccion || ''),
        ocupacion || null,
        fecha_nacimiento || null,
        tipo_sangre || null,
        tipo_persona || null,
        dni || null,
        userId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const usuario = result.rows[0];

    return res.status(200).json({
      message: 'Perfil actualizado exitosamente.',
      usuario: {
        idUsuario: usuario.idUsuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        telefono: usuario.telefono,
        direccion: usuario.direccion,
        ocupacion: usuario.ocupacion,
        fechaNacimiento: usuario.fecha_nacimiento,
        tipoSangre: usuario.tipo_sangre,
        tipoPersona: usuario.tipo_persona,
        dni: usuario.dni,
        debeCambiarPassword: usuario.debe_cambiar_password,
        twoFactorEnabled: usuario.two_factor_enabled,
        avatar: usuario.avatar || null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Actualizar avatar del usuario autenticado (base64)
 */
export const actualizarAvatar = async (req, res, next) => {
  const { avatar } = req.body;
  const userId = req.userId;

  try {
    if (!avatar) {
      return res.status(400).json({ message: 'El campo avatar es obligatorio.' });
    }

    // Validar que sea base64 de imagen (data:image/...;base64,...)
    const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;
    if (!base64Regex.test(avatar)) {
      return res.status(400).json({ message: 'Formato de imagen inválido. Se esperaba base64 de imagen.' });
    }

    // Limitar tamaño ~2MB en base64
    const base64Data = avatar.split(',')[1] || '';
    const sizeBytes = Buffer.byteLength(base64Data, 'base64');
    const maxBytes = 2 * 1024 * 1024; // 2 MB
    if (sizeBytes > maxBytes) {
      return res.status(400).json({ message: 'La imagen es demasiado grande. El límite es 2 MB.' });
    }

    await query(
      'UPDATE public.usuarios SET avatar = $1 WHERE "idUsuario" = $2',
      [avatar, userId]
    );

    // Devolver usuario actualizado
    const result = await query(
      `SELECT "idUsuario", nombre, apellidos, email, rol, telefono, activo, tipo_persona, dni, ruc,
              no_aviso_operacion, fecha_aviso_operacion, rep_legal, fecha_creacion, avatar
       FROM public.usuarios WHERE "idUsuario" = $1`,
      [userId]
    );

    return res.status(200).json({
      message: 'Avatar actualizado exitosamente.',
      usuario: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Eliminar avatar del usuario autenticado
 */
export const eliminarAvatar = async (req, res, next) => {
  const userId = req.userId;
  try {
    await query('UPDATE public.usuarios SET avatar = NULL WHERE "idUsuario" = $1', [userId]);
    return res.status(200).json({ message: 'Avatar eliminado exitosamente.' });
  } catch (error) {
    next(error);
  }
};

