const crypto = require('crypto');
const path = require('path');

function createDocumentId() {
  const token = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `DOC-${token}`;
}

function sanitizeFilename(originalName) {
  const base = (originalName || 'document.pdf').replace(/\\/g, '/').split('/').pop();
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  return cleaned.length > 0 ? cleaned.slice(0, 180) : 'document.pdf';
}

function isInsideDirectory(rootDir, filePath) {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

module.exports = { createDocumentId, sanitizeFilename, isInsideDirectory };
