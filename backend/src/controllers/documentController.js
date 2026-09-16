const fs = require('fs');
const documentService = require('../services/documentService');
const { uploadFieldsSchema } = require('../validators/schemas');

async function upload(req, res, next) {
  try {
    const body = uploadFieldsSchema.parse({
      documentType: req.body.documentType,
      metadata: req.body.metadata,
    });
    const result = await documentService.uploadDocument({
      file: req.file,
      documentType: body.documentType,
      metadata: body.metadata,
    });
    const statusCode = result.duplicate ? 200 : 201;
    res.status(statusCode).json(result);
  } catch (error) {
    next(error);
  }
}

async function getOne(req, res, next) {
  try {
    const document = await documentService.getDocument(req.params.documentId);
    res.json(document);
  } catch (error) {
    next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const history = await documentService.getHistory(req.params.documentId);
    res.json(history);
  } catch (error) {
    next(error);
  }
}

async function list(req, res, next) {
  try {
    const result = await documentService.listDocuments(req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function stats(req, res, next) {
  try {
    const result = await documentService.getStats();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

async function file(req, res, next) {
  try {
    const document = await documentService.getDocumentFile(req.params.documentId);
    if (!fs.existsSync(document.storedPath)) {
      res.status(404).json({
        error: {
          code: 'FILE_NOT_FOUND',
          message: 'Stored file was not found',
        },
      });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${document.filename.replace(/"/g, '')}"`
    );
    fs.createReadStream(document.storedPath).pipe(res);
  } catch (error) {
    next(error);
  }
}

module.exports = { upload, getOne, getHistory, list, stats, file };
