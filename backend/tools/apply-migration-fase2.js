import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { query } from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('=== Migración Fase 2: permitir mismo rol en capítulos distintos ===');

  try {
    console.log('\n1) Diagnóstico: buscando duplicados (usuario, rol, capítulo)...');
    const dup = await query(`
      SELECT id_usuario, id_rol, id_capitulo, COUNT(*) AS cantidad
      FROM public.usuario_rol
      GROUP BY id_usuario, id_rol, id_capitulo
      HAVING COUNT(*) > 1
    `);

    if (dup.rows.length > 0) {
      console.error('❌ Se encontraron duplicados, abortando sin aplicar cambios:');
      console.table(dup.rows);
      process.exitCode = 1;
      return;
    }
    console.log('   Sin duplicados. Continuando...');

    const sqlPath = path.join(__dirname, 'migration-fase2-rol-multicapitulo.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('\n2) Aplicando migration-fase2-rol-multicapitulo.sql...');
    await query(sql);
    console.log('✅ Migración aplicada correctamente.');

    console.log('\n3) Verificando restricciones actuales sobre public.usuario_rol:');
    const check = await query(`
      SELECT conname, pg_get_constraintdef(oid) AS definicion
      FROM pg_constraint
      WHERE conrelid = 'public.usuario_rol'::regclass
      ORDER BY conname
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
