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
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      // Type errors in test files should not block test execution;
      // the spec for BrevoEmailNotificationSender uses `as never` to spy on
      // global.fetch before Node typings expose it in this tsconfig target.
      diagnostics: { warnOnly: true },
    }],
  },
};
