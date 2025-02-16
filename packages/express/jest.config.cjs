/** @type {import('ts-jest/dist/types').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/dist/',
    '/__tests__/mocks',
  ],
  collectCoverageFrom: [
    '**/*.ts',
  ],
  moduleNameMapper: {
    /**
     * Naming packages like this makes transpilers crasy, but it's a real package:
     * https://github.com/whitequark/ipaddr.js
     */
    '^ipaddr\\.js(.*)': 'ipaddr.js$1',

    '(.+)\\.js': '$1',
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/scripts/',
    '.eslintrc.js',
    'jest.config.js',
    '/example/',
    '/dist/',
    '/__tests__/mocks',
    '/examples',
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
