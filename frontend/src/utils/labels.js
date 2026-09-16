export const DOCUMENT_TYPES = [
  { value: 'FINANCIAL_STATEMENT', label: 'Financial statement' },
  { value: 'BANK_STATEMENT', label: 'Bank statement' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'COMPANY_REGISTRATION', label: 'Company registration' },
  { value: 'OTHER', label: 'Other' },
];

export const STATUSES = [
  { value: 'UPLOADED', label: 'Uploaded' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PROCESSED', label: 'Processed' },
  { value: 'FAILED', label: 'Failed' },
];

export function formatDate(value) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString();
}

export function statusLabel(status) {
  return STATUSES.find((item) => item.value === status)?.label || status;
}

export function typeLabel(documentType) {
  return DOCUMENT_TYPES.find((item) => item.value === documentType)?.label || documentType;
}
