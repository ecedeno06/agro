import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { query } from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('=== Agregando campos de perfil a public.usuarios ===');
  try {
    const sqlPath = path.join(__dirname, 'add-perfil-fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await query(sql);
    console.log('✅ Columnas agregadas (o ya existían).');

    const check = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'usuarios'
        AND column_name IN ('direccion', 'ocupacion', 'fecha_nacimiento', 'tipo_sangre')
      ORDER BY column_name
    `);
    console.table(check.rows);
  } catch (error) {
    console.error('❌ Error al aplicar la migración:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
