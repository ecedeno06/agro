import { query } from '../db.js';
import { resolverScope } from '../security/scope.helper.js';

/**
 * Solo el rol global (superadmin) o el administrador de capítulo ('adm')
 * pueden consultar/cerrar sesiones. El resto de roles no tiene acceso,
 * aunque intenten llamar el endpoint directamente.
 */
function puedeVerAuditoria(req) {
  const { esGlobal } = resolverScope(req);
  if (esGlobal) return true;
  return String(req.userRol || '').trim().toLowerCase() === 'adm';
}

/**
 * GET /api/auditoria/sesiones?desde=&hasta=&id_usuario=
 *
 * Como no existe un job que cierre sesiones cuando simplemente expiran sin
 * que el usuario haga logout explícito (nunca se marca activo=false en ese
 * caso), se calculan 3 situaciones posibles en vez de confiar solo en las
 * columnas guardadas:
 *   1) activo = false          -> ya se cerró, se usa razon_salida/duracion_segundos tal cual.
 *   2) activo = true, sin expirar -> sesión todavía en curso.
 *   3) activo = true, expirada    -> quedó abandonada (nadie hizo logout) antes de vencer.
 *
 * Un administrador de capítulo ('adm') solo ve las sesiones de su propio
 * capítulo (columna id_capitulo, ya guardada en cada sesión al iniciar
 * sesión); el superadmin ve todas.
 */
export const listarSesiones = async (req, res, next) => {
  try {
    if (!puedeVerAuditoria(req)) {
      return res.status(403).json({ message: 'Acceso denegado. No tiene permiso para consultar la auditoría de sesiones.' });
    }

    const { esGlobal, idCapitulo } = resolverScope(req);
    const { desde, hasta, id_usuario } = req.query;

    const condiciones = [];
    const valores = [];

    if (!esGlobal) {
      if (idCapitulo == null) {
        return res.status(200).json([]);
      }
      valores.push(idCapitulo);
      condiciones.push(`s.id_capitulo = $${valores.length}`);
    }

    if (desde) {
      valores.push(desde);
      condiciones.push(`s.creado_en::date >= $${valores.length}`);
    }
    if (hasta) {
      valores.push(hasta);
      condiciones.push(`s.creado_en::date <= $${valores.length}`);
    }
    if (id_usuario) {
      valores.push(Number(id_usuario));
      condiciones.push(`s.id_usuario = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const result = await query(
      `SELECT
         s.id,
         s.id_usuario,
         u.nombre AS usuario_nombre,
         u.email AS usuario_email,
         s.rol_codigo,
         cr.descripcion AS rol_nombre,
         s.ip_address,
         s.geo_pais,
         s.geo_region,
         s.geo_ciudad,
         s.creado_en AS login_en,
         s.activo,
         CASE WHEN s.activo = false
           THEN s.creado_en + (COALESCE(s.duracion_segundos, 0) || ' seconds')::interval
         END AS logout_en,
         CASE
           WHEN s.activo = false THEN s.duracion_segundos
           WHEN s.expira_en <= NOW() THEN EXTRACT(EPOCH FROM (s.expira_en - s.creado_en))::integer
           ELSE EXTRACT(EPOCH FROM (NOW() - s.creado_en))::integer
         END AS duracion_segundos,
         CASE
           WHEN s.activo = false THEN COALESCE(s.razon_salida, 'logout_usuario')
           WHEN s.expira_en <= NOW() THEN 'expirada_sin_cerrar'
           ELSE 'en_curso'
         END AS motivo_salida
       FROM public.sesiones s
       JOIN public.usuarios u ON u."idUsuario" = s.id_usuario
       LEFT JOIN public.catalogo_rol cr ON cr.codigo = s.rol_codigo
       ${where}
       ORDER BY s.creado_en DESC`,
      valores
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auditoria/sesiones/cerrar { ids: number[] }
 *
 * Cierra a la fuerza las sesiones indicadas ("terminar sesión" desde la
 * pantalla de Auditoría). Solo tiene efecto real sobre sesiones "en curso"
 * (activo=true): una ya cerrada o ya expirada no cambia nada (el
 * "AND activo = true" las deja fuera), así que es seguro enviar cualquier
 * selección sin filtrarla antes. Un 'adm' solo puede cerrar sesiones de su
 * propio capítulo.
 */
export const cerrarSesiones = async (req, res, next) => {
  try {
    if (!puedeVerAuditoria(req)) {
      return res.status(403).json({ message: 'Acceso denegado. No tiene permiso para cerrar sesiones.' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Debe indicar al menos una sesión.' });
    }

    const { esGlobal, idCapitulo } = resolverScope(req);
    const condiciones = ['id = ANY($1::int[])', 'activo = true'];
    const valores = [ids.map(Number)];

    if (!esGlobal) {
      if (idCapitulo == null) {
        return res.status(403).json({ message: 'Su sesión no tiene un capítulo asociado.' });
      }
      valores.push(idCapitulo);
      condiciones.push(`id_capitulo = $${valores.length}`);
    }

    const result = await query(
      `UPDATE public.sesiones
       SET activo = false,
           razon_salida = 'cerrada_por_admin',
           duracion_segundos = EXTRACT(EPOCH FROM (NOW() - creado_en))::integer
       WHERE ${condiciones.join(' AND ')}
       RETURNING id`,
      valores
    );

    return res.status(200).json({ cerradas: result.rowCount });
  } catch (error) {
    next(error);
  }
};
