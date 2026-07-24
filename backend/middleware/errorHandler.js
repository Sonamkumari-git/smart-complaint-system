function notFound(req, res, next) {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl });
}

function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = { notFound, errorHandler };
