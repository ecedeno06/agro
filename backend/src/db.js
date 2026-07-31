import pg from 'pg';
import dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME || process.env.DB_DATABASE || 'postgres',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

export const query = (text, params) => pool.query(text, params);

/**
 * Ejecuta un bloque de sentencias dentro de una única transacción.
 *
 * Importante: `query()` toma una conexión distinta del pool en cada llamada, por lo
 * que hacer BEGIN/COMMIT con `query()` no garantiza atomicidad. Este helper reserva
 * un cliente dedicado y hace COMMIT o ROLLBACK automáticamente.
 *
 * Uso:
 *   const usuario = await withTransaction(async (tx) => {
 *     const r = await tx('INSERT ... RETURNING *', [...]);
 *     await tx('INSERT ...', [...]);
 *     return r.rows[0];
 *   });
 *
 * @param {(tx: (text: string, params?: any[]) => Promise<import('pg').QueryResult>) => Promise<any>} callback
 */
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = (text, params) => client.query(text, params);
    const resultado = await callback(tx);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error al hacer ROLLBACK:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
};

export default pool;
