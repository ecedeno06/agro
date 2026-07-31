import { createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../db.js';
import { buildSuperuserPayload } from './superuser-payload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Configuración ──────────────────────────────────────────────
const PUBLIC_KEY_PATH = process.env.SUPERUSER_PUBLIC_KEY_PATH;
const PROTECTED_ROLE_CODE = 'superadmin';
const AMBIENTE = process.env.APP_ENVIRONMENT || 'production';

let publicKey = null;

if (PUBLIC_KEY_PATH) {
  try {
    // Resuelto contra la ubicación de este archivo (no contra
    // process.cwd()), para que funcione sin importar desde qué
    // directorio se arranque el servidor.
    const resolvedPath = path.resolve(__dirname, '../..', PUBLIC_KEY_PATH);
    publicKey = createPublicKey(readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    console.error('[Security] Error al cargar clave pública de SUPERADMIN:', error.message);
  }
}

// ── Servicio público ───────────────────────────────────────────

/**
 * Verifica si el usuario tiene una identidad firmada válida como SUPERADMIN.
 * 
 * @param {number} idUsuario - ID del usuario autenticado (debe venir del middleware, NUNCA del body/params)
 * @returns {Promise<boolean>} true solo si existe identidad firmada Y la firma es válida
 */
export async function esSuperadmin(idUsuarioEntrada) {
  // Si no hay clave pública configurada, nadie puede ser superadmin verificado
  if (!publicKey) return false;

  // El driver pg devuelve columnas BIGINT/BIGSERIAL (id_usuario en sesiones/usuarios)
  // como string, no como number. Se normaliza aquí para que la validación de
  // entero seguro funcione sin importar si el caller pasó string o number.
  const idUsuario = Number(idUsuarioEntrada);

  if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
    return false;
  }

  try {
    const result = await query(`
      SELECT
        sai.id_usuario,
        sai.id_rol,
        sai.security_id,
        sai.firma,
        sai.version_firma,
        sai.ambiente,
        sai.activo AS activo_identidad,
        cr.codigo,
        u.activo AS activo_usuario
      FROM security.superuser_identity sai
      INNER JOIN public.usuario_rol ur
        ON ur.id_usuario = sai.id_usuario
       AND ur.id_rol = sai.id_rol
      INNER JOIN public.catalogo_rol cr
        ON cr.idrol = sai.id_rol
      INNER JOIN public.usuarios u
        ON u."idUsuario" = sai.id_usuario
      WHERE sai.id_usuario = $1
        AND cr.codigo = $2
      LIMIT 1
    `, [idUsuario, PROTECTED_ROLE_CODE]);

    if (result.rowCount === 0) {
      return false;
    }

    const row = result.rows[0];

    // Validaciones adicionales de integridad
    if (Number(row.id_usuario) !== idUsuario) return false;
    if (row.codigo !== PROTECTED_ROLE_CODE) return false;
    if (row.ambiente !== AMBIENTE) return false;
    if (row.activo_identidad !== true) return false;
    if (row.activo_usuario !== true) return false;

    // Reconstruir el payload canónico con los datos del registro
    const payload = buildSuperuserPayload({
      idUsuario: Number(row.id_usuario),
      idRol: Number(row.id_rol),
      securityId: row.security_id,
      ambiente: row.ambiente,
      versionFirma: row.version_firma
    });

    // Verificar la firma Ed25519 con la clave pública
    return verify(null, payload, publicKey, row.firma);
  } catch (error) {
    console.error('[Security] Error verificando identidad SUPERADMIN:', error.message);
    return false;
  }
}
