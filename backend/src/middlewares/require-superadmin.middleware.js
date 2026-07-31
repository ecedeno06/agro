import { esSuperadmin } from '../security/superuser.service.js';
import { registrarAuditoria } from '../security/auditoria.service.js';

/**
 * Middleware que verifica identidad firmada de SUPERADMIN.
 * Usar después de authMiddleware en rutas que requieran privilegios de superadministrador.
 * 
 * Ejemplo de uso en rutas:
 *   router.delete('/empresa/:id', authMiddleware, requireSuperadmin, controller);
 */
export default async function requireSuperadmin(req, res, next) {
  try {
    const idUsuario = req.userId; // Viene del authMiddleware (sesión validada en BD)

    if (!idUsuario) {
      return res.status(401).json({ message: 'Usuario no autenticado.' });
    }

    const autorizado = await esSuperadmin(idUsuario);

    if (!autorizado) {
      await registrarAuditoria({
        idUsuario,
        evento: 'INTENTO_ACCESO_SUPERADMIN',
        descripcion: `Endpoint denegado: ${req.method} ${req.originalUrl}`,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(403).json({
        message: 'Se requiere una identidad SUPERADMIN válida.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}
