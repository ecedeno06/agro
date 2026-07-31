import bcrypt from 'bcrypt';
import pool, { query } from './src/db.js';

async function main() {
  const nombre = 'Super Administrador';
  const email = 'superadmin@agro.com';
  const plainPassword = '123456';
  const rol = 'admin';
  const telefono = '999999999';

  console.log(`Intentando crear/actualizar el usuario: ${email}...`);

  try {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    const result = await query(
      `INSERT INTO usuarios (nombre, email, password, telefono, rol) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (email) 
       DO UPDATE SET password = EXCLUDED.password, rol = EXCLUDED.rol
       RETURNING "idUsuario", nombre, email, rol`,
      [nombre, email, hashedPassword, telefono, rol]
    );
    
    console.log('✅ Superadmin registrado con éxito:');
    console.table(result.rows);
  } catch (error) {
    console.error('❌ Error al crear el usuario superadmin:', error.message);
  } finally {
    pool.end();
  }
}

main();
