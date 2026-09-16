const { AppError } = require('../utils/errors');

function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireDocumentId(req, res, next) {
  if (!req.params.documentId) {
    next(new AppError('DOCUMENT_ID_REQUIRED', 'documentId is required', 400));
    return;
  }
  next();
}

module.exports = { validateBody, validateQuery, requireDocumentId };
