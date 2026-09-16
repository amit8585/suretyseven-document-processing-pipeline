const multer = require('multer');
const { config } = require('../config');
const { AppError } = require('../utils/errors');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxFileSizeBytes,
  },
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      (file.originalname || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      cb(new AppError('UNSUPPORTED_FILE_TYPE', 'Only PDF files are supported', 415));
      return;
    }
    cb(null, true);
  },
});

function singlePdf(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(
        new AppError(
          'FILE_TOO_LARGE',
          `File exceeds the ${Math.floor(config.maxFileSizeBytes / (1024 * 1024))}MB limit`,
          413
        )
      );
      return;
    }
    next(error);
  });
}

module.exports = { singlePdf };
