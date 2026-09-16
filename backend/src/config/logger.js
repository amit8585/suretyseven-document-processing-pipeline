function log(level, message, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitize(fields),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

const SENSITIVE_KEYS = new Set([
  'result',
  'extracted',
  'file',
  'buffer',
  'contents',
  'password',
  'companyName',
  'registrationNumber',
  'address',
  'annualRevenue',
  'documentDate',
  'details',
]);

function sanitize(fields) {
  const clean = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEYS.has(key)) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

const logger = {
  info: (message, fields) => log('info', message, fields),
  warn: (message, fields) => log('warn', message, fields),
  error: (message, fields) => log('error', message, fields),
};

module.exports = { logger };
