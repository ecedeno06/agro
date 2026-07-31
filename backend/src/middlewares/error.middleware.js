const errorMiddleware = (err, req, res, next) => {
  console.error('================ ERROR INTERNO ================');
  console.error(err.stack || err);
  console.error('==============================================');

  const status = err.status || 500;
  const message = err.message || 'Ocurrió un error interno en el servidor.';

  return res.status(status).json({
    status,
    message,
    // Solo mostrar el stack trace en desarrollo si fuera necesario
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

export default errorMiddleware;
