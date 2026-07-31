import pool, { query } from './src/db.js';

async function main() {
  console.log('Iniciando copia de usuarios desde "agro_usuarios" a "usuarios"...');
  try {
    const res = await query(
      `INSERT INTO usuarios (nombre, email, password, telefono, rol, activo)
       SELECT nombre, email, password, telefono, rol, activo
       FROM agro_usuarios
       ON CONFLICT (email) DO NOTHING
       RETURNING "idUsuario", nombre, email, rol`
    );
    
    console.log(`✅ Proceso completado. Se copiaron ${res.rows.length} usuarios nuevos.`);
    if (res.rows.length > 0) {
      console.log('Usuarios copiados:');
      console.table(res.rows);
    } else {
      console.log('No se copiaron usuarios nuevos (todos los correos ya existían en la tabla "usuarios").');
    }
  } catch (error) {
    console.error('❌ Error al copiar usuarios:', error.message);
  } finally {
    pool.end();
  }
}

main();
