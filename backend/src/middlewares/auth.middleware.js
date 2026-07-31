import { query } from '../db.js';
import { esRolGlobal } from '../security/scope.helper.js';

/**
 * Middleware que valida el token de sesión en la base de datos (como en Mascotas).
 * Si el token es válido y no ha expirado, adjunta req.userId y continúa.
 * Si es inválido o expirado, responde 401.
 */
export default async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token de sesión no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Desactivar sesiones expiradas automáticamente en la DB
    await query(
      `UPDATE public.sesiones 
       SET activo = false, 
           razon_salida = 'expiracion_automatica', 
           duracion_segundos = EXTRACT(EPOCH FROM (expira_en - creado_en))::integer
       WHERE activo = true AND expira_en <= NOW()`
    );

    // Consultar validez de la sesión activa (incluye el capítulo del rol activo)
    const result = await query(
      `SELECT s.id_usuario, s.rol_codigo, s.id_capitulo, r.idrol AS rol_id, u.debe_cambiar_password
       FROM public.sesiones s
       JOIN public.usuarios u ON u."idUsuario" = s.id_usuario
       LEFT JOIN public.catalogo_rol r ON r.codigo = s.rol_codigo
       WHERE s.token = $1 AND s.activo = true AND s.expira_en > NOW()`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'Sesión expirada o inválida. Inicie sesión nuevamente.' });
    }

    const sessionUser = result.rows[0];
    const isChangePasswordRoute = 
      req.path === '/usuarios/cambiar-password' || 
      req.originalUrl === '/api/usuarios/cambiar-password';

    // Bloquear si debe cambiar contraseña y no va hacia cambiar-password
    if (sessionUser.debe_cambiar_password && !isChangePasswordRoute) {
      return res.status(403).json({
        message: 'Debe cambiar su contraseña obligatoriamente para poder continuar.',
        requiresPasswordChange: true
      });
    }

    req.userId = sessionUser.id_usuario;
    req.userRol = sessionUser.rol_codigo;
    req.userRolId = sessionUser.rol_id;

    // Contexto de capítulo de la sesión. Los controladores deben usar
    // security/scope.helper.js para decidir si filtran por este valor.
    req.userCapituloId = sessionUser.id_capitulo != null ? Number(sessionUser.id_capitulo) : null;
    req.isGlobalRole = esRolGlobal(sessionUser.rol_codigo);

    next();
  } catch (error) {
    console.error('Error en middleware de autenticación por DB:', error);
    return res.status(500).json({ message: 'Error interno al validar la sesión' });
  }
}
