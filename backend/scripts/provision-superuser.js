/**
 * Aprovisionamiento del SUPERADMIN con identidad firmada.
 *
 * Este script firma criptográficamente a un usuario como SUPERADMIN legítimo.
 * Solo debe ejecutarse por un administrador autorizado.
 *
 * Regla de la Fase 1: ningún SUPERADMIN nuevo se firma sin que un
 * SUPERADMIN ya existente, activo y verificado autorice la operación
 * (--actor). La única excepción es el primero (--bootstrap), y solo
 * si todavía no existe ninguna identidad activa.
 *
 * Uso:
 *   Caso normal (un SUPERADMIN existente autoriza a uno nuevo):
 *     SUPERUSER_PRIVATE_KEY_PASSPHRASE="frase-secreta" \
 *     node scripts/provision-superuser.js <idUsuarioNuevo> --actor <idSuperadminActuante>
 *
 *   Solo para el primer SUPERADMIN, cuando no existe ninguno activo:
 *     SUPERUSER_PRIVATE_KEY_PASSPHRASE="frase-secreta" \
 *     node scripts/provision-superuser.js <idUsuarioNuevo> --bootstrap
 */

import { createPrivateKey, createPublicKey, randomUUID, sign, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

import { buildSuperuserPayload } from '../src/security/superuser-payload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno del backend
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { Pool } = pg;

const USO =
  'Uso: node scripts/provision-superuser.js <idUsuarioNuevo> ' +
  '(--actor <idSuperadminActuante> | --bootstrap)';

/**
 * Verifica que el actor sea un SUPERADMIN legítimo: rol correcto,
 * usuario activo, identidad activa y firma Ed25519 válida.
 *
 * Reutiliza exactamente los mismos criterios que
 * superuser.service.js → esSuperadmin(). Si cambias uno, cambia el otro.
 */
async function verificarActorEsSuperadmin(client, publicKey, ambiente, idActor) {
  const result = await client.query(
    `
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
        AND cr.codigo = 'superadmin'
      LIMIT 1
    `,
    [idActor]
  );

  const registro = result.rows[0];

  if (!registro) {
    throw new Error(`El actor ${idActor} no tiene identidad SUPERADMIN registrada`);
  }

  if (
    registro.activo_usuario !== true ||
    registro.activo_identidad !== true ||
    registro.ambiente !== ambiente
  ) {
    throw new Error(`El actor ${idActor} no es un SUPERADMIN activo en el ambiente ${ambiente}`);
  }

  const payload = buildSuperuserPayload({
    idUsuario: Number(registro.id_usuario),
    idRol: Number(registro.id_rol),
    securityId: registro.security_id,
    ambiente: registro.ambiente,
    versionFirma: registro.version_firma
  });

  const firmaValida = verify(null, payload, publicKey, registro.firma);

  if (!firmaValida) {
    throw new Error(`La firma del actor ${idActor} no es válida; no puede autorizar`);
  }
}

async function main() {
  // ── Validar argumentos ────────────────────────────────────────
  const argumentos = process.argv.slice(2);
  const idUsuario = Number(argumentos[0]);

  if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0) {
    console.error(`❌ ${USO}`);
    process.exit(1);
  }

  const esBootstrap = argumentos.includes('--bootstrap');
  const indiceActor = argumentos.indexOf('--actor');
  const idActor = indiceActor >= 0 ? Number(argumentos[indiceActor + 1]) : null;

  if (esBootstrap && idActor !== null) {
    console.error('❌ Usa --actor o --bootstrap, no ambos');
    process.exit(1);
  }

  if (!esBootstrap && (idActor === null || !Number.isSafeInteger(idActor) || idActor <= 0)) {
    console.error(`❌ ${USO}`);
    process.exit(1);
  }

  if (!esBootstrap && idActor === idUsuario) {
    console.error('❌ Un usuario no puede autorizar su propia identidad SUPERADMIN');
    process.exit(1);
  }

  // ── Validar passphrase ────────────────────────────────────────
  const passphrase = process.env.SUPERUSER_PRIVATE_KEY_PASSPHRASE;
  if (!passphrase) {
    console.error('❌ Falta SUPERUSER_PRIVATE_KEY_PASSPHRASE');
    process.exit(1);
  }

  // ── Cargar clave privada ──────────────────────────────────────
  const privateKeyPath = path.resolve(__dirname, '..', 'secrets', 'superuser-private.pem');
  let privateKey;
  let publicKey;

  try {
    const privateKeyPem = readFileSync(privateKeyPath, 'utf8');
    privateKey = createPrivateKey({ key: privateKeyPem, format: 'pem', passphrase });
    // La clave pública se deriva de la privada: no hace falta leer el
    // .pem público solo para verificar la firma del actor.
    publicKey = createPublicKey(privateKey);
  } catch (error) {
    console.error('❌ Error al cargar la clave privada:', error.message);
    console.error('   Asegúrate de haber generado las claves primero:');
    console.error('   node scripts/generate-superuser-keys.js');
    process.exit(1);
  }

  // ── Conectar a la base de datos ───────────────────────────────
  // Usa SECURITY_DATABASE_URL (cuenta security_provisioner, ver
  // scripts/migration-fase1-permisos.sql) si ya está configurada;
  // si no, cae de vuelta a las variables DB_* normales del backend.
  const ambiente = process.env.APP_ENVIRONMENT || 'production';

  const pool = process.env.SECURITY_DATABASE_URL
    ? new Pool({ connectionString: process.env.SECURITY_DATABASE_URL })
    : new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME || process.env.DB_DATABASE || 'postgres',
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432')
      });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Autorización: solo un SUPERADMIN puede agregar otro ──────
    // Se bloquea la tabla para que dos ejecuciones simultáneas no
    // puedan colarse ambas por la vía de bootstrap.
    await client.query('LOCK TABLE security.superuser_identity IN EXCLUSIVE MODE');

    const conteoResult = await client.query(
      `SELECT COUNT(*)::text AS total FROM security.superuser_identity WHERE activo = true`
    );
    const superadminsActivos = Number(conteoResult.rows[0].total);

    if (esBootstrap) {
      if (superadminsActivos > 0) {
        throw new Error(
          'Ya existe al menos un SUPERADMIN activo: usa --actor <idSuperadmin>, no --bootstrap'
        );
      }
      console.warn('⚠️  MODO BOOTSTRAP: creando el primer SUPERADMIN sin autorización previa.');
    } else {
      if (superadminsActivos === 0) {
        throw new Error(
          'No hay ningún SUPERADMIN activo que pueda autorizar. Si es el primero, usa --bootstrap'
        );
      }
      await verificarActorEsSuperadmin(client, publicKey, ambiente, idActor);
      console.log(`✅ Autorizado por el SUPERADMIN ${idActor}`);
    }

    // ── Verificar que el usuario existe ───────────────────────────
    const usuarioResult = await client.query(
      'SELECT "idUsuario", nombre, email FROM public.usuarios WHERE "idUsuario" = $1',
      [idUsuario]
    );

    if (usuarioResult.rowCount !== 1) {
      throw new Error(`El usuario con id ${idUsuario} no existe en la tabla usuarios.`);
    }

    const usuario = usuarioResult.rows[0];
    console.log(`👤 Usuario encontrado: ${usuario.nombre} (${usuario.email})`);

    // ── Buscar el rol SUPERADMIN ──────────────────────────────────
    const rolResult = await client.query(
      `SELECT idrol FROM public.catalogo_rol WHERE codigo = 'superadmin' LIMIT 1`
    );

    if (rolResult.rowCount !== 1) {
      throw new Error('No existe el rol SUPERADMIN en catalogo_rol. Ejecuta la migración SQL primero.');
    }

    const idRol = Number(rolResult.rows[0].idrol);
    console.log(`🏷️  Rol SUPERADMIN encontrado: idrol = ${idRol}`);

    // ── Asegurar la asignación en usuario_rol ─────────────────────
    // Restricción única real: uq_usuario_rol_capitulo (id_usuario, id_rol,
    // id_capitulo) — ver tools/migration-fase2-rol-multicapitulo.sql.
    await client.query(
      `INSERT INTO public.usuario_rol (id_capitulo, id_usuario, id_rol, fecha_creacion, expira, activo)
       VALUES (1, $1, $2, CURRENT_DATE, false, true)
       ON CONFLICT (id_usuario, id_rol, id_capitulo) DO UPDATE SET activo = true`,
      [idUsuario, idRol]
    );
    console.log('✅ Asignación en usuario_rol verificada.');

    // ── Generar identidad firmada ─────────────────────────────────
    const securityId = randomUUID();
    const versionFirma = 1;

    const payload = buildSuperuserPayload({
      idUsuario,
      idRol,
      securityId,
      ambiente,
      versionFirma
    });

    console.log('');
    console.log('📋 Payload a firmar:');
    console.log(payload.toString('utf8'));
    console.log('');

    const firma = sign(null, payload, privateKey);

    // ── Insertar/actualizar en la tabla de identidad ──────────────
    // ON CONFLICT (id_usuario): cada usuario tiene su propia fila
    // (uq_superuser_identity_usuario). Provisionar un idUsuario
    // distinto agrega un SUPERADMIN adicional sin afectar a los ya
    // existentes; repetir el mismo idUsuario solo rota esa identidad.
    await client.query(
      `INSERT INTO security.superuser_identity
         (id_usuario, id_rol, security_id, firma, version_firma, ambiente, activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (id_usuario) DO UPDATE SET
         id_rol         = EXCLUDED.id_rol,
         security_id    = EXCLUDED.security_id,
         firma          = EXCLUDED.firma,
         version_firma  = EXCLUDED.version_firma,
         ambiente       = EXCLUDED.ambiente,
         activo         = true,
         actualizado_en = NOW()`,
      [idUsuario, idRol, securityId, firma, versionFirma, ambiente]
    );

    await client.query('COMMIT');

    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Usuario ${idUsuario} (${usuario.nombre}) firmado como SUPERADMIN`);
    console.log(`   security_id: ${securityId}`);
    console.log(`   ambiente:    ${ambiente}`);
    console.log(`   firma:       ${firma.toString('hex').substring(0, 32)}...`);
    console.log('═══════════════════════════════════════════════════');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
