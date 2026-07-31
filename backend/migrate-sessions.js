import pool, { query } from './src/db.js';

async function main() {
  console.log('Creando tabla de "sesiones" en la base de datos Supabase con el esquema exacto...');
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS public.sesiones (
          id SERIAL PRIMARY KEY,
          token VARCHAR(100) NOT NULL UNIQUE,
          id_usuario INT NOT NULL,
          creado_en TIMESTAMPTZ DEFAULT now(),
          expira_en TIMESTAMPTZ NOT NULL,
          activo BOOLEAN DEFAULT true,
          razon_salida VARCHAR(100),
          duracion_segundos INT,
          CONSTRAINT fk_usuario FOREIGN KEY (id_usuario) REFERENCES public.usuarios("idUsuario") ON DELETE CASCADE
      );
    `);
    console.log('✅ Tabla "sesiones" creada o verificada con el esquema exacto exitosamente.');
  } catch (error) {
    console.error('❌ Error al crear la tabla:', error.message);
  } finally {
    pool.end();
  }
}

main();
