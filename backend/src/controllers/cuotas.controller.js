import { query } from '../db.js';

/**
 * Obtener todos los pagos de cuota del usuario autenticado
 */
export const getCuotas = async (req, res, next) => {
  const userId = req.userId;
  const { anio, capitulo } = req.query;

  try {
    let queryStr = `
      SELECT 
        ca.*,
        c.nombre_capitulo,
        u.nombre AS nombre_registrado_por
      FROM public.cuotas_asociados ca
      JOIN public.capitulo c ON ca.id_capitulo = c.id_capitulo
      LEFT JOIN public.usuarios u ON ca.creado_por = u."idUsuario"
      WHERE ca.id_usuario = $1
    `;
    const params = [userId];

    if (anio) {
      params.push(Number(anio));
      queryStr += ` AND ca.anio_periodo = $${params.length}`;
    }

    if (capitulo) {
      params.push(Number(capitulo));
      queryStr += ` AND ca.id_capitulo = $${params.length}`;
    }

    queryStr += ` ORDER BY ca.anio_periodo DESC, ca.mes_periodo DESC`;

    const result = await query(queryStr, params);
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};

/**
 * Registrar un nuevo pago de cuota (Solo los Asociados 'aso' pueden registrar sus pagos, o Tesoreros/Admins)
 */
export const registrarPagoCuota = async (req, res, next) => {
  const userId = req.userId;

  try {
    const {
      id_capitulo,
      monto,
      fecha_pago,
      anio_periodo,
      mes_periodo,
      metodo_pago,
      referencia_pago,
      observaciones
    } = req.body;

    if (!id_capitulo || !monto || !anio_periodo || !mes_periodo || !metodo_pago) {
      return res.status(400).json({ 
        message: 'Los campos capítulo, monto, año, mes y método de pago son obligatorios.' 
      });
    }

    // Verificar si ya existe un pago aprobado para ese período y capítulo del usuario
    const checkDup = await query(
      `SELECT id_cuota FROM public.cuotas_asociados 
       WHERE id_usuario = $1 AND id_capitulo = $2 AND anio_periodo = $3 AND mes_periodo = $4 AND estado = 'aprobado'`,
      [userId, id_capitulo, anio_periodo, mes_periodo]
    );

    if (checkDup.rows.length > 0) {
      return res.status(400).json({ 
        message: `Ya existe un pago registrado y aprobado para el mes ${mes_periodo} del año ${anio_periodo} en este capítulo.` 
      });
    }

    const result = await query(
      `INSERT INTO public.cuotas_asociados (
        id_usuario, id_capitulo, monto, fecha_pago, anio_periodo,
        mes_periodo, metodo_pago, referencia_pago, observaciones, creado_por, estado
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, 'aprobado'
      ) RETURNING *`,
      [
        userId,
        id_capitulo,
        monto,
        fecha_pago || new Date(),
        anio_periodo,
        mes_periodo,
        metodo_pago,
        referencia_pago || null,
        observaciones || null,
        userId
      ]
    );

    return res.status(201).json({
      message: 'Pago de cuota registrado exitosamente.',
      cuota: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obtener todos los capítulos a los que está asociado el usuario autenticado
 */
export const getCapitulosAsociados = async (req, res, next) => {
  const userId = req.userId;

  try {
    const result = await query(
      `SELECT DISTINCT c.id_capitulo, c.nombre_capitulo
       FROM public.usuario_rol ur
       JOIN public.capitulo c ON ur.id_capitulo = c.id_capitulo
       WHERE ur.id_usuario = $1 AND ur.activo = true`,
      [userId]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
};
