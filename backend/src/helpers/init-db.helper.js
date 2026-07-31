import bcrypt from 'bcrypt';
import { query } from '../db.js';

export const ensureSuperadminExists = async () => {
  const email = process.env.SUPERADMIN_EMAIL || 'superadmin@agro.com';
  const nombre = process.env.SUPERADMIN_NAME || 'Super Administrador';
  const plainPassword = process.env.SUPERADMIN_PASSWORD || '123456';
  const rol = 'superadmin';
  const telefono = process.env.SUPERADMIN_PHONE || '999999999';

  try {
    const checkUser = await query('SELECT "idUsuario" FROM usuarios WHERE email = $1', [email]);

    let idUsuario;
    if (checkUser.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      const resUser = await query(
        `INSERT INTO usuarios (nombre, email, password, telefono, rol, activo)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING "idUsuario"`,
        [nombre, email, hashedPassword, telefono, rol]
      );
      idUsuario = resUser.rows[0].idUsuario;
      console.log(`[DB Init] ✅ Usuario superadmin (${email}) creado exitosamente.`);
    } else {
      idUsuario = checkUser.rows[0].idUsuario;
      console.log(`[DB Init] ℹ️ Usuario superadmin (${email}) ya existe en la base de datos.`);
    }

    // Verificar si existe el rol 'adm'/'ADMIN' en catalogo_rol y asignarlo en usuario_rol si falta
    const checkRol = await query(
      `SELECT idrol FROM public.catalogo_rol WHERE codigo IN ('SUPERADMIN', 'adm', 'ADMIN') LIMIT 1`
    );

    if (checkRol.rows.length > 0) {
      const idRol = checkRol.rows[0].idrol;
      const checkMapping = await query(
        `SELECT id_registro FROM public.usuario_rol WHERE id_usuario = $1 AND id_rol = $2`,
        [idUsuario, idRol]
      );

      if (checkMapping.rows.length === 0) {
        await query(
          `INSERT INTO public.usuario_rol (id_capitulo, id_usuario, id_rol, fecha_creacion, expira, activo)
           VALUES (1, $1, $2, CURRENT_DATE, false, true)`,
          [idUsuario, idRol]
        );
        console.log(`[DB Init] ✅ Rol de administrador asignado al superadmin en usuario_rol.`);
      }
    }
  } catch (error) {
    console.error('[DB Init] ❌ Error al verificar/crear usuario superadmin:', error.message);
  }
};
