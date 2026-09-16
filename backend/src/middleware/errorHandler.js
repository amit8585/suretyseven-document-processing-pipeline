const { ZodError } = require('zod');
const { AppError } = require('../utils/errors');
const { logger } = require('../config/logger');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues[0]?.message || 'Invalid request',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.') || undefined,
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error('Unhandled error', {
    failureReason: err.message,
    path: req.path,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
}

module.exports = { errorHandler, notFoundHandler };
