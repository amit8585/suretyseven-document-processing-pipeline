const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'Request failed');
    error.code = payload?.error?.code || 'REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }

  return payload;
}

export const api = {
  uploadDocument(formData) {
    return request('/documents', {
      method: 'POST',
      body: formData,
    });
  },
  listDocuments(params) {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.set(key, value);
      }
    });
    return request(`/documents?${query.toString()}`);
  },
  getDocument(documentId) {
    return request(`/documents/${documentId}`);
  },
  getHistory(documentId) {
    return request(`/documents/${documentId}/history`);
  },
  getStats() {
    return request('/documents/stats');
  },
  fileUrl(documentId) {
    return `${API_BASE}/documents/${documentId}/file`;
  },
};

export function userFacingError(error) {
  const map = {
    FILE_REQUIRED: 'Please choose a PDF file before uploading.',
    UNSUPPORTED_FILE_TYPE: 'Only PDF files can be uploaded.',
    FILE_TOO_LARGE: 'That file is too large. Please upload a PDF under 10MB.',
    VALIDATION_ERROR: 'Please check the form and try again.',
    DOCUMENT_NOT_FOUND: 'We could not find that document.',
    QUEUE_UNAVAILABLE: 'The document was saved, but processing is temporarily unavailable.',
    REQUEST_FAILED: 'Something went wrong. Please try again.',
  };
  return map[error?.code] || 'Something went wrong. Please try again.';
}
