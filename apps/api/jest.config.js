module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.int-spec.ts'],
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/src/$1' },
};
