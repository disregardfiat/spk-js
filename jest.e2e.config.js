module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/e2e'],
  testMatch: [
    '**/*.e2e.test.+(ts|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  testTimeout: 30000, // E2E tests may take longer
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@storage/(.*)$': '<rootDir>/src/storage/$1',
    '^@tokens/(.*)$': '<rootDir>/src/tokens/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  }
};