import { query } from '../db.js';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

// --- TAB 1: ROLES Y MATRIZ DE PERMISOS ---

export const getRoles = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT idrol AS "idRol", codigo, descripcion FROM public.catalogo_rol WHERE activo = true ORDER BY idrol ASC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getMenus = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, nombre, ruta, icono, padre_id, orden FROM public.menus WHERE estado = true ORDER BY orden ASC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getPermissionsList = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, codigo, nombre FROM public.permisos WHERE activo = true ORDER BY id ASC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getRolePermissions = async (req, res, next) => {
  const { rolId } = req.params;
  try {
    const result = await query(
      'SELECT menu_id, permiso_id FROM public.rol_menu_permiso WHERE rol_id = $1',
      [rolId]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const saveRolePermissions = async (req, res, next) => {
  const { rolId, mappings } = req.body; // mappings: Array<{ menuId, permisoId }>

  try {
    // Iniciar transacción básica manual
    await query('BEGIN');

    // 1. Eliminar mapeos antiguos
    await query('DELETE FROM public.rol_menu_permiso WHERE rol_id = $1', [rolId]);

    // 2. Insertar nuevos mapeos en lote si existen
    if (mappings && mappings.length > 0) {
      let valuesClause = mappings.map((_, idx) => `($1, $${idx * 2 + 2}, $${idx * 2 + 3})`).join(', ');
      let params = [rolId];
      mappings.forEach(m => {
        params.push(m.menuId, m.permisoId);
      });

      await query(
        `INSERT INTO public.rol_menu_permiso (rol_id, menu_id, permiso_id) VALUES ${valuesClause}`,
        params
      );
    }

    await query('COMMIT');
    return res.status(200).json({ message: 'Permisos actualizados correctamente para el rol.' });
  } catch (error) {
    await query('ROLLBACK');
    next(error);
  }
};

export const crearRol = async (req, res, next) => {
  const { codigo, descripcion } = req.body;

  try {
    if (!codigo || !descripcion) {
      return res.status(400).json({ message: 'El código y la descripción son obligatorios.' });
    }

    const check = await query('SELECT idrol FROM public.catalogo_rol WHERE codigo = $1', [codigo.trim().toLowerCase()]);
    if (check.rows.length > 0) {
      return res.status(409).json({ message: 'El código de rol ya existe.' });
    }

    const result = await query(
      `INSERT INTO public.catalogo_rol (codigo, descripcion, activo, essuper, essistema, esglobal, id_capitulo, esjunta)
       VALUES ($1, $2, true, false, false, true, 1, false)
       RETURNING idrol AS "idRol", codigo, descripcion`,
      [codigo.trim().toLowerCase(), descripcion.trim()]
    );

    return res.status(201).json({
      message: 'Rol creado exitosamente.',
      rol: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

export const crearPermiso = async (req, res, next) => {
  const { codigo, nombre } = req.body;

  try {
    if (!codigo || !nombre) {
      return res.status(400).json({ message: 'El código y el nombre del permiso son obligatorios.' });
    }

    const check = await query('SELECT id FROM public.permisos WHERE codigo = $1', [codigo.trim().toLowerCase()]);
    if (check.rows.length > 0) {
      return res.status(409).json({ message: 'El código de permiso ya existe.' });
    }

    const result = await query(
      `INSERT INTO public.permisos (codigo, nombre)
       VALUES ($1, $2)
       RETURNING id, codigo, nombre`,
      [codigo.trim().toLowerCase(), nombre.trim()]
    );

    return res.status(201).json({
      message: 'Permiso creado exitosamente.',
      permiso: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

export const getMenusAll = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, nombre, ruta, icono, padre_id, orden, estado FROM public.menus ORDER BY id ASC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const crearMenu = async (req, res, next) => {
  const { nombre, ruta, icono, padre_id, orden } = req.body;

  try {
    if (!nombre || !ruta || !icono) {
      return res.status(400).json({ message: 'El nombre, ruta e icono son obligatorios.' });
    }

    await query(
      `INSERT INTO public.menus (nombre, ruta, icono, padre_id, orden, estado)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [nombre.trim(), ruta.trim(), icono.trim(), padre_id || null, orden || 1]
    );

    return res.status(201).json({ message: 'Menú creado exitosamente.' });
  } catch (error) {
    next(error);
  }
};

export const updateMenu = async (req, res, next) => {
  const { id } = req.params;
  const { nombre, ruta, icono, padre_id, orden, estado } = req.body;

  try {
    await query(
      `UPDATE public.menus
       SET nombre = $1, ruta = $2, icono = $3, padre_id = $4, orden = $5, estado = $6
       WHERE id = $7`,
      [nombre.trim(), ruta.trim(), icono.trim(), padre_id || null, orden, estado, id]
    );
    return res.status(200).json({ message: 'Menú modificado exitosamente.' });
  } catch (error) {
    next(error);
  }
};

export const getRolesAll = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT idrol AS "idRol", codigo, descripcion, activo FROM public.catalogo_rol ORDER BY idrol ASC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const updateRol = async (req, res, next) => {
  const { idRol } = req.params;
  const { codigo, descripcion, activo } = req.body;

  try {
    await query(
      'UPDATE public.catalogo_rol SET codigo = $1, descripcion = $2, activo = $3 WHERE idrol = $4',
      [codigo.trim().toLowerCase(), descripcion.trim(), activo, idRol]
    );
    return res.status(200).json({ message: 'Rol modificado exitosamente.' });
  } catch (error) {
    next(error);
  }
};

export const getPermissionsListAll = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, codigo, nombre, activo FROM public.permisos ORDER BY id ASC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const updatePermiso = async (req, res, next) => {
  const { id } = req.params;
  const { codigo, nombre, activo } = req.body;

  try {
    await query(
      'UPDATE public.permisos SET codigo = $1, nombre = $2, activo = $3 WHERE id = $4',
      [codigo.trim().toLowerCase(), nombre.trim(), activo, id]
    );
    return res.status(200).json({ message: 'Permiso modificado exitosamente.' });
  } catch (error) {
    next(error);
  }
};

// --- TAB 2: USUARIOS Y PERFILES DE ACCESO ---

export const getUsers = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT "idUsuario", nombre, email, rol FROM public.usuarios WHERE activo = true ORDER BY "idUsuario" ASC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getChapters = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id_capitulo, nombre_capitulo FROM public.capitulo WHERE activo = true ORDER BY id_capitulo ASC'
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getUserRoles = async (req, res, next) => {
  const { userId } = req.params;
  try {
    const result = await query(
      `SELECT ur.id_registro, ur.id_rol, cr.codigo AS rol_codigo, cr.descripcion AS rol_descripcion, 
              ur.id_capitulo, c.nombre_capitulo
       FROM public.usuario_rol ur
       JOIN public.catalogo_rol cr ON ur.id_rol = cr.idrol
       LEFT JOIN public.capitulo c ON ur.id_capitulo = c.id_capitulo
       WHERE ur.id_usuario = $1 AND ur.activo = true`,
      [userId]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const saveUserRole = async (req, res, next) => {
  const { userId, rolId, idCapitulo } = req.body;

  try {
    // Validar si ya existe ese rol activo para el usuario en ese capítulo
    const check = await query(
      'SELECT id_registro FROM public.usuario_rol WHERE id_usuario = $1 AND id_rol = $2 AND id_capitulo = $3 AND activo = true',
      [userId, rolId, idCapitulo]
    );

    if (check.rows.length > 0) {
      return res.status(409).json({ message: 'Este perfil de rol y capítulo ya está asignado al usuario.' });
    }

    // Insertar asignación
    await query(
      `INSERT INTO public.usuario_rol (id_usuario, id_rol, id_capitulo, fecha_creacion, expira, activo)
       VALUES ($1, $2, $3, CURRENT_DATE, false, true)`,
      [userId, rolId, idCapitulo]
    );

    return res.status(201).json({ message: 'Perfil de rol asignado exitosamente.' });
  } catch (error) {
    next(error);
  }
};

export const deleteUserRole = async (req, res, next) => {
  const { idRegistro } = req.params;

  try {
    await query(
      'DELETE FROM public.usuario_rol WHERE id_registro = $1',
      [idRegistro]
    );
    return res.status(200).json({ message: 'Rol revocado del usuario correctamente.' });
  } catch (error) {
    next(error);
  }
};

function calcularDistanciaLevenshtein(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  const matriz = [];
  for (let i = 0; i <= s2.length; i++) matriz[i] = [i];
  for (let j = 0; j <= s1.length; j++) matriz[0][j] = j;

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matriz[i][j] = matriz[i - 1][j - 1];
      } else {
        matriz[i][j] = Math.min(
          matriz[i - 1][j - 1] + 1, // Sustitución
          matriz[i][j - 1] + 1,     // Inserción
          matriz[i - 1][j] + 1      // Eliminación
        );
      }
    }
  }
  return matriz[s2.length][s1.length];
}

export const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword, pista } = req.body;
  const userId = req.userId;

  try {
    if (!currentPassword || !newPassword || !pista) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }

    // 1. Obtener usuario
    const userRes = await query(
      'SELECT password FROM public.usuarios WHERE "idUsuario" = $1',
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const dbPassword = userRes.rows[0].password;

    // 2. Verificar contraseña actual
    const match = await bcrypt.compare(currentPassword, dbPassword);
    if (!match) {
      return res.status(401).json({ message: 'La contraseña actual es incorrecta.' });
    }

    // 3. Validar similitud
    const distancia = calcularDistanciaLevenshtein(newPassword, pista);
    const longitudMaxima = Math.max(newPassword.length, pista.length);
    const similitud = (1 - (distancia / longitudMaxima)) * 100;

    if (similitud > 70) {
      return res.status(400).json({
        message: `La pista es demasiado obvia (${similitud.toFixed(0)}% de similitud). Por seguridad, la pista no debe parecerse a la contraseña más de un 70%.`
      });
    }

    // 4. Cifrar la nueva contraseña
    const passwordHashed = await bcrypt.hash(newPassword, 10);

    // 5. Guardar contraseña y pista en DB
    await query(
      'UPDATE public.usuarios SET password = $1, pista = $2 WHERE "idUsuario" = $3',
      [passwordHashed, pista.trim(), userId]
    );

    return res.status(200).json({ message: 'Contraseña y pista actualizadas con éxito.' });
  } catch (error) {
    next(error);
  }
};

export const getIconsList = async (req, res, next) => {
  try {
    const possibleDirs = [
      path.join(process.cwd(), '../frontEnd/public/assets/icons'),
      path.join(process.cwd(), '../frontEnd/src/assets/icons'),
      path.join(process.cwd(), 'public/assets/icons'),
      path.join(process.cwd(), 'src/assets/icons')
    ];

    const foundFiles = new Set();
    const iconsList = [];

    for (const dirPath of possibleDirs) {
      if (fs.existsSync(dirPath)) {
        try {
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (['.png', '.svg', '.jpg', '.jpeg', '.webp', '.gif', '.ico'].includes(ext)) {
              if (!foundFiles.has(file)) {
                foundFiles.add(file);
                const nombreLimpio = path.basename(file, ext).replace(/[-_]/g, ' ');
                const nombreFormateado = nombreLimpio.charAt(0).toUpperCase() + nombreLimpio.slice(1);
                iconsList.push({
                  nombre: nombreFormateado,
                  ruta: `/assets/icons/${file}`
                });
              }
            }
          }
        } catch (e) {
          console.error(`Error leyendo directorio ${dirPath}:`, e);
        }
      }
    }

    return res.status(200).json(iconsList);
  } catch (error) {
    next(error);
  }
};
