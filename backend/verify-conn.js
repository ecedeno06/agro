import pool from './src/db.js';

console.log('Verificando conexión con los datos del .env actual...');
console.log('Host configurado:', process.env.DB_HOST);
console.log('Usuario configurado:', process.env.DB_USER);
console.log('Base de datos configurada:', process.env.DB_NAME);

pool.query(
  'SELECT current_database() as db, current_user as user, inet_server_addr() as server_ip, version()',
  (err, res) => {
    if (err) {
      console.error('❌ Error de conexión:', err.message);
    } else {
      console.log('✅ ¡Conexión Exitosa!');
      console.log('Detalles reales de la sesión PostgreSQL:');
      console.log('  Base de Datos actual:', res.rows[0].db);
      console.log('  Usuario actual:', res.rows[0].user);
      console.log('  IP del Servidor:', res.rows[0].server_ip);
      console.log('  Versión de Postgres:', res.rows[0].version);
    }
    pool.end();
  }
);
