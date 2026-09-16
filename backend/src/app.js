const express = require('express');
const cors = require('cors');
const { config } = require('./config');
const documentsRouter = require('./routes/documents');
const healthRouter = require('./routes/health');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    cors({
      origin: config.corsOrigin.split(',').map((value) => value.trim()),
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/health', healthRouter);
  app.use('/documents', documentsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
