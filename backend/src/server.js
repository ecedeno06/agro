import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.js';
import { ensureSuperadminExists } from './helpers/init-db.helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables. Se resuelve contra la ubicación de este
// archivo (no contra process.cwd()) para que funcione igual sin importar
// desde qué directorio se arranque el proceso (npm run dev, botón "Run"
// del IDE, etc.).
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`=========================================`);
  console.log(` Agro1.0 API Server running on port ${PORT}`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(`=========================================`);
  
  // Auto-creación / verificación del usuario superadmin al arrancar el servidor
  await ensureSuperadminExists();

  // Verificar configuración de identidad firmada SUPERADMIN
  if (process.env.SUPERUSER_PUBLIC_KEY_PATH) {
    try {
      readFileSync(path.resolve(__dirname, '..', process.env.SUPERUSER_PUBLIC_KEY_PATH));
      console.log('[Security] ✅ Clave pública de SUPERADMIN cargada correctamente.');
    } catch {
      console.warn('[Security] ⚠️  No se pudo leer la clave pública. Verificación de SUPERADMIN deshabilitada.');
    }
  } else {
    console.warn('[Security] ⚠️  SUPERUSER_PUBLIC_KEY_PATH no definida. Verificación de SUPERADMIN deshabilitada.');
  }
});
