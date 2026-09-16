const { ProcessorError } = require('../utils/errors');

const SUCCESS_RESULT = {
  companyName: 'ABC Construction Pvt Ltd',
  registrationNumber: 'U12345DL2020PTC123456',
  address: 'New Delhi',
  annualRevenue: 12500000,
  documentDate: '2026-08-15',
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class MockDocumentProcessor {
  constructor({ scenario = 'SUCCESS', delayMs = 0, sequence } = {}) {
    this.scenario = scenario;
    this.delayMs = delayMs;
    this.sequence = sequence;
    this.callCount = 0;
  }

  async process(document, context = {}) {
    this.callCount += 1;
    if (this.delayMs > 0) {
      await delay(this.delayMs);
    }

    const scenario = this.resolveScenario(document, context.attempt);
    return this.runScenario(scenario);
  }

  resolveScenario(document, attempt = 1) {
    if (this.sequence && this.sequence.length > 0) {
      const index = Math.min(this.callCount - 1, this.sequence.length - 1);
      return this.sequence[index];
    }
    const simulated = document?.metadata?.simulateOutcome;
    if (typeof simulated === 'string' && simulated.trim()) {
      const value = simulated.trim().toUpperCase();
      if (value === 'RETRY_THEN_SUCCESS' || value === 'TIMEOUT_THEN_SUCCESS') {
        return attempt <= 1 ? 'TIMEOUT' : 'SUCCESS';
      }
      return value;
    }
    return this.scenario;
  }

  runScenario(scenario) {
    switch (scenario) {
      case 'SUCCESS':
        return { ...SUCCESS_RESULT };
      case 'VALIDATION_FAILED':
        return {
          companyName: '',
          registrationNumber: '',
          annualRevenue: -1,
          documentDate: 'not-a-date',
        };
      case 'INVALID_RESULT':
        throw new ProcessorError(
          'INVALID_RESULT',
          'Processor returned an unusable result',
          false
        );
      case 'TIMEOUT':
        throw new ProcessorError('TIMEOUT', 'Processor timed out while extracting document data', true);
      case 'ERROR':
      case 'PROCESSOR_ERROR':
        throw new ProcessorError(
          'PROCESSOR_ERROR',
          'Processor failed with an unexpected error',
          true
        );
      default:
        throw new ProcessorError(
          'PROCESSOR_ERROR',
          `Unknown processor scenario: ${scenario}`,
          true
        );
    }
  }
}

module.exports = { MockDocumentProcessor, SUCCESS_RESULT };
