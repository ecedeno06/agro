/**
 * Construye el payload canónico que se firma y verifica.
 * La misma función se usa al FIRMAR (script de aprovisionamiento) y al VERIFICAR (backend).
 * 
 * Si cualquier dato cambia (idUsuario, idRol, securityId, etc.), 
 * el payload resultante será diferente y la firma no verificará.
 */
export function buildSuperuserPayload({ idUsuario, idRol, securityId, ambiente, versionFirma }) {
  if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
    throw new Error('idUsuario inválido');
  }
  if (!Number.isSafeInteger(idRol) || idRol <= 0) {
    throw new Error('idRol inválido');
  }
  if (!Number.isSafeInteger(versionFirma) || versionFirma <= 0) {
    throw new Error('versionFirma inválida');
  }
  if (!securityId) {
    throw new Error('securityId inválido');
  }
  if (!ambiente) {
    throw new Error('ambiente inválido');
  }

  const content = [
    'type=SUPERADMIN_IDENTITY',
    `version=${versionFirma}`,
    `environment=${ambiente}`,
    `user_id=${idUsuario}`,
    `role_id=${idRol}`,
    `security_id=${securityId}`,
    'authority=SUPERADMIN'
  ].join('\n');

  return Buffer.from(content, 'utf8');
}
