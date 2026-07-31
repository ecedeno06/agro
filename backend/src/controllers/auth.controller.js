import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { query } from '../db.js';
import { createSession } from './session.helper.js';
import { esSuperadmin } from '../security/superuser.service.js';
import { registrarAuditoria } from '../security/auditoria.service.js';

// Encriptación simétrica para guardar el secret key del 2FA de forma segura
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey() {
  const rawKey = process.env.CRYPTO_SECRET_KEY;
  if (!rawKey) {
    throw new Error('Error de configuración: CRYPTO_SECRET_KEY no está definida en las variables de entorno.');
  }

  if (rawKey.length === 64) {
    try {
      const hexBuf = Buffer.from(rawKey, 'hex');
      if (hexBuf.length === 32) return hexBuf;
    } catch (e) {}
  }
  const buf = Buffer.from(rawKey);
  if (buf.length === 32) return buf;

  throw new Error('Error de configuración: CRYPTO_SECRET_KEY debe tener exactamente 32 caracteres (o 64 caracteres en formato hexadecimal).');
}

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  try {
    const key = getEncryptionKey();
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Error al desencriptar secret de 2FA:', error);
    throw new Error('Error al descifrar el secreto de doble factor.');
  }
}

async function getUserRoles(idUsuario) {
  try {
    const rolesResult = await query(
      `SELECT 
         ur.id_registro,
         ur.id_capitulo,
         c.nombre_capitulo,
         ur.id_rol,
         cr.codigo AS codigo_rol,
         cr.descripcion AS rol_descripcion
       FROM public.usuario_rol ur
       JOIN public.catalogo_rol cr ON ur.id_rol = cr.idrol
       LEFT JOIN public.capitulo c ON ur.id_capitulo = c.id_capitulo
       WHERE ur.id_usuario = $1 AND ur.activo = true AND cr.activo = true`,
      [idUsuario]
    );
    return rolesResult.rows.map(r => ({
      idRegistro: Number(r.id_registro),
      idCapitulo: r.id_capitulo ? Number(r.id_capitulo) : null,
      nombreCapitulo: r.nombre_capitulo || null,
      idRol: Number(r.id_rol),
      rol: r.codigo_rol,
      descripcion: r.rol_descripcion
    }));
  } catch (error) {
    console.error('Error al obtener roles de usuario:', error.message);
    return [];
  }
}

/**
 * Verifica identidad firmada para SUPERADMIN y filtra el rol si no es válida.
 * Modifica el array userRoles in-place.
 * @returns {Promise<boolean>} isSuperadmin
 */
async function verificarIdentidadSuperadmin(userRoles, idUsuario, req) {
  const tieneSuperadmin = userRoles.some(r => r.rol === 'superadmin');
  if (!tieneSuperadmin) return false;

  const firmaValida = await esSuperadmin(idUsuario);
  if (firmaValida) {
    await registrarAuditoria({
      idUsuario,
      evento: 'LOGIN_SUPERADMIN',
      descripcion: 'Inicio de sesión con identidad SUPERADMIN verificada',
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    return true;
  }

  // Firma inválida: retirar el rol SUPERADMIN de los roles efectivos
  const idx = userRoles.findIndex(r => r.rol === 'superadmin');
  if (idx !== -1) userRoles.splice(idx, 1);

  await registrarAuditoria({
    idUsuario,
    evento: 'SUPERADMIN_SIN_FIRMA_VALIDA',
    descripcion: 'Tiene rol SUPERADMIN en usuario_rol pero no hay identidad firmada válida',
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  return false;
}

export const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'El correo y la contraseña son obligatorios.' });
    }

    // Buscar al usuario en la base de datos (con idUsuario en camelCase)
    const result = await query(
      'SELECT "idUsuario", nombre, email, password, rol, activo, debe_cambiar_password, two_factor_enabled, two_factor_secret FROM usuarios WHERE email = $1 AND activo = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    const usuario = result.rows[0];

    // Verificar la contraseña
    const match = await bcrypt.compare(password, usuario.password);
    if (!match) {
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // Si el doble factor está activado, detener el login y solicitar OTP
    if (usuario.two_factor_enabled && usuario.two_factor_secret) {
      return res.status(200).json({
        message: 'Se requiere verificación de doble factor (2FA).',
        requires2FA: true,
        idUsuario: usuario.idUsuario,
        usuario: {
          idUsuario: usuario.idUsuario,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol
        }
      });
    }

    // Consultar roles asignados en usuario_rol
    const userRoles = await getUserRoles(usuario.idUsuario);

    // Verificar identidad firmada si tiene rol SUPERADMIN
    const isSuperadmin = await verificarIdentidadSuperadmin(userRoles, usuario.idUsuario, req);

    // Si tiene múltiples roles asignados, requerir selección de rol
    if (userRoles.length > 1) {
      return res.status(200).json({
        message: 'Seleccione un perfil de acceso.',
        requiresRolSelection: true,
        idUsuario: usuario.idUsuario,
        roles: userRoles,
        isSuperadmin
      });
    }

    // Si tiene un único rol asignado en usuario_rol
    const activeRole = userRoles.length === 1 ? userRoles[0] : null;
    const activeRoleCode = activeRole ? activeRole.rol : usuario.rol;

    // Registrar sesión en la base de datos con el rol activo y su capítulo
    const { token, expiresIn } = await createSession(
      usuario.idUsuario,
      activeRoleCode,
      activeRole ? activeRole.idCapitulo : null
    );

    return res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      token,
      usuario: {
        idUsuario: usuario.idUsuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: activeRole ? activeRole.rol : usuario.rol,
        rolDescripcion: activeRole ? activeRole.descripcion : null,
        idCapitulo: activeRole ? activeRole.idCapitulo : null,
        nombreCapitulo: activeRole ? activeRole.nombreCapitulo : null,
        debeCambiarPassword: usuario.debe_cambiar_password,
        isSuperadmin
      },
      expiresIn
    });

  } catch (error) {
    next(error);
  }
};

export const me = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT "idUsuario", nombre, email, rol, telefono, activo, debe_cambiar_password, two_factor_enabled, avatar FROM usuarios WHERE "idUsuario" = $1 AND activo = true',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const usuario = result.rows[0];
    const activeRol = req.userRol || usuario.rol;

    // Verificar identidad firmada si el rol activo es SUPERADMIN
    const isSuperadmin = (activeRol === 'superadmin')
      ? await esSuperadmin(usuario.idUsuario)
      : false;

    return res.status(200).json({
      usuario: {
        idUsuario: usuario.idUsuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: activeRol,
        telefono: usuario.telefono,
        debeCambiarPassword: usuario.debe_cambiar_password,
        twoFactorEnabled: usuario.two_factor_enabled,
        avatar: usuario.avatar || null,
        isSuperadmin
      }
    });
  } catch (error) {
    next(error);
  }
};

export const setup2FA = async (req, res, next) => {
  const { idUsuario } = req.body;

  if (!idUsuario) {
    return res.status(400).json({ message: 'El ID de usuario es requerido' });
  }

  try {
    const userResult = await query(
      'SELECT email FROM public.usuarios WHERE "idUsuario" = $1',
      [idUsuario]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const user = userResult.rows[0];

    // Generar clave secreta TOTP única
    const secret = authenticator.generateSecret();

    // Crear la URI estándar para el enrolamiento en el autenticador
    const otpauth = authenticator.keyuri(user.email, 'AgroAzuero', secret);

    // Generar imagen QR en Base64
    QRCode.toDataURL(otpauth, (err, qrCode) => {
      if (err) {
        return res.status(500).json({ message: 'Error al generar código QR' });
      }
      return res.json({
        secret,
        qrCode
      });
    });

  } catch (error) {
    next(error);
  }
};

export const enable2FA = async (req, res, next) => {
  const { idUsuario, secret, code } = req.body;

  if (!idUsuario || !secret || !code) {
    return res.status(400).json({ message: 'ID de usuario, secreto y código de verificación son requeridos' });
  }

  try {
    // Validar el código TOTP ingresado
    const isValid = authenticator.check(code, secret);

    if (!isValid) {
      return res.status(400).json({ message: 'Código de verificación incorrecto' });
    }

    // Encriptar el secret key antes de guardarlo en Supabase
    const encryptedSecret = encrypt(secret);

    await query(
      'UPDATE public.usuarios SET two_factor_secret = $1, two_factor_enabled = true WHERE "idUsuario" = $2',
      [encryptedSecret, idUsuario]
    );

    return res.json({ success: true, message: 'Autenticación de doble factor activada correctamente' });

  } catch (error) {
    next(error);
  }
};

export const disable2FA = async (req, res, next) => {
  const { idUsuario, code } = req.body;

  if (!idUsuario || !code) {
    return res.status(400).json({ message: 'El ID de usuario y el código de verificación son requeridos' });
  }

  try {
    // Obtener el secreto encriptado del usuario
    const userResult = await query(
      'SELECT two_factor_secret, two_factor_enabled FROM public.usuarios WHERE "idUsuario" = $1 AND activo = true',
      [idUsuario]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado o inactivo' });
    }

    const user = userResult.rows[0];

    if (!user.two_factor_enabled || !user.two_factor_secret) {
      return res.status(400).json({ message: 'El doble factor no está habilitado para este usuario' });
    }

    // Desencriptar el secreto y verificar el código TOTP
    const secret = decrypt(user.two_factor_secret);
    const isValid = authenticator.check(code, secret);

    if (!isValid) {
      return res.status(400).json({ message: 'Código de verificación incorrecto. No se desactivó el 2FA.' });
    }

    // Desactivar
    await query(
      'UPDATE public.usuarios SET two_factor_secret = NULL, two_factor_enabled = false WHERE "idUsuario" = $1',
      [idUsuario]
    );

    return res.json({ success: true, message: 'Autenticación de doble factor desactivada correctamente' });

  } catch (error) {
    next(error);
  }
};

export const verifyLogin2FA = async (req, res, next) => {
  const { idUsuario, code } = req.body;

  if (!idUsuario || !code) {
    return res.status(400).json({ message: 'ID de usuario y código son requeridos' });
  }

  try {
    const userResult = await query(
      'SELECT "idUsuario", nombre, email, two_factor_secret, two_factor_enabled, debe_cambiar_password FROM public.usuarios WHERE "idUsuario" = $1 AND activo = true',
      [idUsuario]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado o inactivo' });
    }

    const user = userResult.rows[0];

    if (!user.two_factor_enabled || !user.two_factor_secret) {
      return res.status(400).json({ message: 'Doble factor no está configurado para este usuario' });
    }

    // Desencriptar el secreto de Supabase
    const secret = decrypt(user.two_factor_secret);

    // Verificar el código actual
    const isValid = authenticator.check(code, secret);

    if (!isValid) {
      return res.status(400).json({ message: 'Código de verificación incorrecto' });
    }

    // Código válido: verificar si tiene múltiples roles
    const userRoles = await getUserRoles(user.idUsuario);

    // Verificar identidad firmada si tiene rol SUPERADMIN
    const isSuperadmin = await verificarIdentidadSuperadmin(userRoles, user.idUsuario, req);

    if (userRoles.length > 1) {
      return res.status(200).json({
        message: 'Seleccione un perfil de acceso.',
        requiresRolSelection: true,
        idUsuario: user.idUsuario,
        roles: userRoles,
        isSuperadmin
      });
    }

    const activeRole = userRoles.length === 1 ? userRoles[0] : null;
    const activeRoleCode = activeRole ? activeRole.rol : user.rol;

    // Código válido: registrar sesión en la base de datos con el rol activo y su capítulo
    const { token, expiresIn } = await createSession(
      user.idUsuario,
      activeRoleCode,
      activeRole ? activeRole.idCapitulo : null
    );

    return res.json({
      success: true,
      token,
      usuario: {
        idUsuario: user.idUsuario,
        nombre: user.nombre,
        email: user.email,
        rol: activeRole ? activeRole.rol : user.rol,
        rolDescripcion: activeRole ? activeRole.descripcion : null,
        idCapitulo: activeRole ? activeRole.idCapitulo : null,
        nombreCapitulo: activeRole ? activeRole.nombreCapitulo : null,
        debeCambiarPassword: user.debe_cambiar_password,
        isSuperadmin
      },
      expiresIn
    });

  } catch (error) {
    next(error);
  }
};

export const selectRol = async (req, res, next) => {
  const { idUsuario, rol, idRegistro, idCapitulo } = req.body;

  if (!idUsuario) {
    return res.status(400).json({ message: 'El ID de usuario es requerido.' });
  }

  try {
    const userResult = await query(
      'SELECT "idUsuario", nombre, email, rol, activo, debe_cambiar_password FROM usuarios WHERE "idUsuario" = $1 AND activo = true',
      [idUsuario]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const usuario = userResult.rows[0];
    const userRoles = await getUserRoles(usuario.idUsuario);

    let selectedRole = userRoles.find(r => 
      (idRegistro && r.idRegistro === Number(idRegistro)) ||
      (r.rol === rol && (!idCapitulo || r.idCapitulo === Number(idCapitulo)))
    );

    if (!selectedRole && userRoles.length > 0) {
      selectedRole = userRoles.find(r => r.rol === rol) || userRoles[0];
    }

    const chosenRoleCode = selectedRole ? selectedRole.rol : (rol || usuario.rol);

    // Verificar identidad firmada si se selecciona SUPERADMIN
    let isSuperadmin = false;
    if (chosenRoleCode === 'superadmin') {
      isSuperadmin = await esSuperadmin(usuario.idUsuario);
      if (!isSuperadmin) {
        await registrarAuditoria({
          idUsuario: usuario.idUsuario,
          evento: 'SUPERADMIN_SIN_FIRMA_VALIDA',
          descripcion: 'Intentó seleccionar rol SUPERADMIN sin identidad firmada',
          ip: req.ip,
          userAgent: req.headers['user-agent']
        });
        return res.status(403).json({
          message: 'No tiene autorización para el perfil SUPERADMIN.'
        });
      }
    }

    // El capítulo se toma del rol seleccionado en usuario_rol, nunca del body,
    // para evitar que el cliente pueda escalar a otro capítulo.
    const { token, expiresIn } = await createSession(
      usuario.idUsuario,
      chosenRoleCode,
      selectedRole ? selectedRole.idCapitulo : null
    );

    return res.status(200).json({
      message: 'Rol seleccionado exitosamente.',
      token,
      usuario: {
        idUsuario: usuario.idUsuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: selectedRole ? selectedRole.rol : (rol || usuario.rol),
        rolDescripcion: selectedRole ? selectedRole.descripcion : null,
        idCapitulo: selectedRole ? selectedRole.idCapitulo : null,
        nombreCapitulo: selectedRole ? selectedRole.nombreCapitulo : null,
        debeCambiarPassword: usuario.debe_cambiar_password,
        isSuperadmin
      },
      expiresIn
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(400).json({ message: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  const { razon } = req.body || {};
  const razonSalida = razon || 'logout_usuario';

  try {
    await query(
      `UPDATE public.sesiones 
       SET activo = false, 
           razon_salida = $1, 
           duracion_segundos = EXTRACT(EPOCH FROM (NOW() - creado_en))::integer
       WHERE token = $2`,
      [razonSalida, token]
    );

    return res.json({ success: true, message: 'Sesión cerrada correctamente en base de datos.' });
  } catch (error) {
    next(error);
  }
};

export const refreshSession = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(400).json({ message: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const result = await query(
      'SELECT token FROM public.sesiones WHERE token = $1 AND activo = true AND expira_en > NOW()',
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'Sesión expirada o inválida' });
    }

    const newExpiry = new Date();
    newExpiry.setHours(newExpiry.getHours() + Number(process.env.SESSION_DURATION_HOURS || 8));

    await query(
      'UPDATE public.sesiones SET expira_en = $1 WHERE token = $2',
      [newExpiry.toISOString(), token]
    );

    return res.json({
      success: true,
      expiresIn: Number(process.env.SESSION_DURATION_HOURS || 8) * 60 * 60 * 1000,
      message: 'Sesión renovada correctamente en base de datos.'
    });
  } catch (error) {
    next(error);
  }
};

export const getSessionConfig = async (req, res, next) => {
  try {
    const inactivityLimitMin = Number(process.env.SESSION_INACTIVITY_LIMIT_MINUTES) || 15;
    const warningBeforeMin = Number(process.env.SESSION_WARNING_BEFORE_MINUTES) || 2;
    const refreshIntervalMin = Number(process.env.SESSION_REFRESH_INTERVAL_MINUTES) || 10;
    const hintMaxSimilarity = Number(process.env.PASSWORD_HINT_MAX_SIMILARITY) || 70;

    return res.json({
      inactivityLimitMs: inactivityLimitMin * 60 * 1000,
      warningBeforeMs: warningBeforeMin * 60 * 1000,
      refreshIntervalMs: refreshIntervalMin * 60 * 1000,
      hintMaxSimilarity
    });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: 'El correo electrónico es obligatorio.' });
    }

    // Buscar si el usuario existe
    const result = await query(
      'SELECT "idUsuario", nombre FROM usuarios WHERE email = $1 AND activo = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'El correo electrónico no está registrado.' });
    }

    // Generar contraseña temporal aleatoria de 8 caracteres
    const tempPassword = Math.random().toString(36).substring(2, 10);
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

    // Actualizar la contraseña en la base de datos y marcar cambio obligatorio
    await query(
      'UPDATE usuarios SET password = $1, debe_cambiar_password = true WHERE email = $2',
      [hashedPassword, email]
    );

    console.log(`=========================================`);
    console.log(`🔑 RECUPERACIÓN DE CONTRASEÑA`);
    console.log(`Usuario: ${email}`);
    console.log(`Contraseña Temporal Generada: ${tempPassword}`);
    console.log(`=========================================`);

    return res.status(200).json({
      message: 'Se ha generado una contraseña temporal y se ha enviado a su correo (ver consola del backend).'
    });

  } catch (error) {
    next(error);
  }
};

export const obtenerPista = async (req, res, next) => {
  const { email } = req.query;

  try {
    if (!email) {
      return res.status(400).json({ message: 'El correo electrónico es obligatorio.' });
    }

    const result = await query(
      'SELECT pista FROM usuarios WHERE email = $1 AND activo = true',
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado o inactivo.' });
    }

    const user = result.rows[0];
    if (!user.pista) {
      return res.status(404).json({ message: 'El usuario no tiene una pista configurada.' });
    }

    return res.status(200).json({ pista: user.pista });
  } catch (error) {
    next(error);
  }
};
