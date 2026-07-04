module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.int-spec.ts', '**/*.e2e-spec.ts'],
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/src/$1' },
  // Integration & e2e suites share a single Postgres and clean up with
  // table-wide deleteMany. Run suites serially so parallel cleanups can't
  // wipe each other's data mid-test. The suite is small; serial is fast enough.
  maxWorkers: 1,
};
