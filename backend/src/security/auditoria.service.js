import { query } from '../db.js';

/**
 * Registra un evento de seguridad en la tabla de auditoría.
 * No lanza errores para evitar interrumpir el flujo principal.
 * 
 * @param {Object} params
 * @param {number}  params.idUsuario  - ID del usuario involucrado
 * @param {string}  params.evento     - Código del evento (ej: 'SUPERADMIN_SIN_FIRMA_VALIDA')
 * @param {string}  [params.descripcion] - Descripción adicional
 * @param {string}  [params.ip]          - Dirección IP del cliente
 * @param {string}  [params.userAgent]   - User-Agent del cliente
 */
export async function registrarAuditoria({ idUsuario, evento, descripcion, ip, userAgent }) {
  try {
    await query(
      `INSERT INTO security.auditoria_seguridad 
         (id_usuario, evento, descripcion, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [idUsuario, evento, descripcion || null, ip || null, userAgent || null]
    );
  } catch (error) {
    // No interrumpir el flujo principal si la auditoría falla
    console.error('[Auditoria] Error al registrar evento de seguridad:', error.message);
  }
}
