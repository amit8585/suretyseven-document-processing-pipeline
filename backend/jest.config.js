module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 30000,
};
