/**
 * Genera par de claves Ed25519 para la identidad firmada del SUPERADMIN.
 *
 * Uso:
 *   En PowerShell:
 *     $env:SUPERUSER_PRIVATE_KEY_PASSPHRASE="frase-secreta-larga"; node scripts/generate-superuser-keys.js
 *
 *   En Bash:
 *     SUPERUSER_PRIVATE_KEY_PASSPHRASE="frase-secreta-larga" node scripts/generate-superuser-keys.js
 *
 * Salida:
 *   secrets/superuser-public.pem   → Copiar al backend (verificación)
 *   secrets/superuser-private.pem  → Guardar fuera del backend (solo para firmar)
 */

import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDirectory = path.resolve(__dirname, '..', 'secrets');

const passphrase = process.env.SUPERUSER_PRIVATE_KEY_PASSPHRASE;

if (!passphrase) {
  console.error('❌ Error: Falta la variable de entorno SUPERUSER_PRIVATE_KEY_PASSPHRASE');
  console.error('');
  console.error('Uso (PowerShell):');
  console.error('  $env:SUPERUSER_PRIVATE_KEY_PASSPHRASE="frase-secreta-larga"; node scripts/generate-superuser-keys.js');
  console.error('');
  console.error('Uso (Bash):');
  console.error('  SUPERUSER_PRIVATE_KEY_PASSPHRASE="frase-secreta-larga" node scripts/generate-superuser-keys.js');
  process.exit(1);
}

if (passphrase.length < 8) {
  console.error('❌ Error: La passphrase debe tener al menos 8 caracteres.');
  process.exit(1);
}

// Crear directorio de salida
mkdirSync(outputDirectory, { recursive: true });

console.log('🔐 Generando par de claves Ed25519...');

const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
    cipher: 'aes-256-cbc',
    passphrase
  }
});

const publicKeyPath = path.join(outputDirectory, 'superuser-public.pem');
const privateKeyPath = path.join(outputDirectory, 'superuser-private.pem');

writeFileSync(publicKeyPath, publicKey, { encoding: 'utf8' });
writeFileSync(privateKeyPath, privateKey, { encoding: 'utf8' });

console.log('');
console.log('✅ Claves generadas exitosamente:');
console.log(`   📄 Clave pública:  ${publicKeyPath}`);
console.log(`   🔒 Clave privada:  ${privateKeyPath}`);
console.log('');
console.log('⚠️  IMPORTANTE:');
console.log('   • La clave PÚBLICA se queda en el backend (para verificar).');
console.log('   • La clave PRIVADA debe guardarse fuera del backend (solo para aprovisionar).');
console.log('   • Nunca subas la clave privada a Git.');
console.log('   • Recuerda la passphrase — la necesitarás para aprovisionar.');
console.log('');
console.log('Siguiente paso:');
console.log('   node scripts/provision-superuser.js <idUsuario>');
