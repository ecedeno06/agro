import pool, { query } from './src/db.js';

async function main() {
  try {
    const res = await query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'usuarios' 
       ORDER BY ordinal_position`
    );
    console.log('Columnas de la tabla "usuarios":');
    console.table(res.rows);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

main();
