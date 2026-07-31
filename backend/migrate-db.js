import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, 'src', 'models', 'schema.sql');

console.log('Iniciando migración de base de datos...');

try {
  const sql = fs.readFileSync(schemaPath, 'utf8');
  console.log('Leyendo archivo schema.sql...');

  pool.query(sql, (err, res) => {
    if (err) {
      console.error('❌ Error ejecutando el script SQL:', err.message);
      console.error(err);
    } else {
      console.log('✅ Migración completada. Estructura de base de datos y datos semilla creados.');
    }
    pool.end();
  });
} catch (error) {
  console.error('❌ Error leyendo el archivo SQL:', error.message);
  pool.end();
}
