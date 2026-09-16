const { z } = require('zod');

const DOCUMENT_TYPES = [
  'FINANCIAL_STATEMENT',
  'BANK_STATEMENT',
  'INVOICE',
  'COMPANY_REGISTRATION',
  'OTHER',
];

const STATUSES = ['UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED'];

const uploadFieldsSchema = z.object({
  documentType: z
    .string({ required_error: 'documentType is required' })
    .trim()
    .min(1, 'documentType is required')
    .refine((value) => DOCUMENT_TYPES.includes(value), {
      message: `documentType must be one of: ${DOCUMENT_TYPES.join(', ')}`,
    }),
  metadata: z
    .union([z.string(), z.record(z.any())])
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') {
        return {};
      }
      if (typeof value === 'object') {
        return value;
      }
      try {
        const parsed = JSON.parse(value);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
          throw new Error('metadata must be a JSON object');
        }
        return parsed;
      } catch (error) {
        throw new z.ZodError([
          {
            code: 'custom',
            path: ['metadata'],
            message: 'metadata must be valid JSON object',
          },
        ]);
      }
    }),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z
    .string()
    .optional()
    .transform((value) => (value ? value.toUpperCase() : undefined))
    .refine((value) => !value || STATUSES.includes(value), {
      message: `status must be one of: ${STATUSES.join(', ')}`,
    }),
  documentType: z
    .string()
    .optional()
    .refine((value) => !value || DOCUMENT_TYPES.includes(value), {
      message: `documentType must be one of: ${DOCUMENT_TYPES.join(', ')}`,
    }),
  search: z.string().trim().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const extractedDataSchema = z.object({
  companyName: z.string({ required_error: 'companyName is required' }).trim().min(1, 'companyName is required'),
  registrationNumber: z
    .string({ required_error: 'registrationNumber is required' })
    .trim()
    .min(1, 'registrationNumber is required'),
  address: z.string().optional(),
  annualRevenue: z
    .number({
      required_error: 'annualRevenue is required',
      invalid_type_error: 'annualRevenue must be a number',
    })
    .min(0, 'Must be greater than or equal to 0'),
  documentDate: z
    .string({ required_error: 'documentDate is required' })
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'documentDate must be a valid date',
    }),
});

module.exports = {
  DOCUMENT_TYPES,
  STATUSES,
  uploadFieldsSchema,
  listQuerySchema,
  extractedDataSchema,
};
