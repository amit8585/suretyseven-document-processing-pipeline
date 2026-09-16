class AppError extends Error {
  constructor(code, message, statusCode = 400, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

class ProcessorError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = 'ProcessorError';
    this.code = code;
    this.retryable = retryable;
  }
}

function isRetryableProcessorFailure(code) {
  return code === 'TIMEOUT' || code === 'PROCESSOR_ERROR';
}

module.exports = {
  AppError,
  ProcessorError,
  isRetryableProcessorFailure,
};
