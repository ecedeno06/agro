import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar el .env de agro1.0
dotenv.config({ path: path.resolve(__dirname, '.env') });

const { Pool } = pg;

// Conectarse explícitamente a 'postgres' para poder crear la nueva BD
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: 'postgres', // Conectamos a 'postgres' por defecto
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

async function main() {
  console.log(`Conectando a ${process.env.DB_HOST} (base de datos 'postgres') para crear 'agroAzuero'...`);
  try {
    await pool.query('CREATE DATABASE "agroAzuero"');
    console.log('✅ Base de datos "agroAzuero" creada con éxito en el host de agro1.0.');
  } catch (error) {
    if (error.code === '42P04') {
      console.log('ℹ️ La base de datos "agroAzuero" ya existe en este servidor.');
    } else {
      console.error('❌ Error al crear la base de datos:', error.message);
    }
  } finally {
    await pool.end();
  }
}

main();
