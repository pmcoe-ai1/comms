module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@generated/(.*)$': '<rootDir>/generated/$1',
    '^@rules/(.*)$': '<rootDir>/src/rules/$1',
  },
  collectCoverageFrom: [
    'src/rules/**/*.ts',
    'src/operations/**/*.ts',
  ],
  coverageThreshold: {
    global: { lines: 80 }
  }
};
