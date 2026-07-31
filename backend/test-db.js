import pool from './src/db.js';

console.log('Probando conexión y consultando usuarios en la base de datos PostgreSQL...');

pool.query('SELECT "idUsuario", nombre, email, rol, fecha_creacion FROM usuarios', (err, res) => {
  if (err) {
    console.error('❌ Error de conexión o consulta a la base de datos:', err.message);
    console.error(err);
    process.exit(1);
  } else {
    console.log('✅ Conexión establecida con éxito.');
    console.log('Usuarios encontrados en "usuarios":');
    console.table(res.rows);
  }
  pool.end();
});
