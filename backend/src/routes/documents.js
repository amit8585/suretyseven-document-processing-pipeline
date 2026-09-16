const express = require('express');
const documentController = require('../controllers/documentController');
const { singlePdf } = require('../middleware/upload');
const { validateQuery } = require('../middleware/validate');
const { listQuerySchema } = require('../validators/schemas');

const router = express.Router();

router.get('/stats', documentController.stats);
router.get('/', validateQuery(listQuerySchema), documentController.list);
router.post('/', singlePdf, documentController.upload);
router.get('/:documentId/history', documentController.getHistory);
router.get('/:documentId/file', documentController.file);
router.get('/:documentId', documentController.getOne);

module.exports = router;
