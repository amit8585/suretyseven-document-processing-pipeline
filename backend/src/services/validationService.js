const { extractedDataSchema } = require('../validators/schemas');

function validateExtractedData(data) {
  const parsed = extractedDataSchema.safeParse(data);
  if (parsed.success) {
    return { valid: true, data: parsed.data, errors: [] };
  }

  const errors = parsed.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));

  return {
    valid: false,
    data,
    errors,
  };
}

module.exports = { validateExtractedData };
