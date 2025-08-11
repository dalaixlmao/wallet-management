/**
 * Jest configuration for the application
 * Configuration optimized for Next.js with React Testing Library
 */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/lib/(.*)$': '<rootDir>/app/lib/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
  testTimeout: 20000, // Increased timeout for tests that interact with database or external services
  verbose: true,
  // Performance optimizations
  cacheDirectory: '.test-cache/jest-cache',
  maxWorkers: '50%', // Use up to half of available CPU cores
  maxConcurrency: 5, // Limit concurrency for test files
  // Improved reporting
  testResultsProcessor: '<rootDir>/node_modules/jest-junit-reporter',
  // Support running tests in parallel
  runInBand: false, // Allow tests to run in parallel by default
  bail: 0, // Don't stop on first test failure
  // Improved error handling
  errorOnDeprecated: true,
  detectOpenHandles: true,
  forceExit: true, // Force exit after all tests complete
  // Cache and speed optimizations
  transformIgnorePatterns: [
    '/node_modules/(?!next|@next|next-auth)'
  ],
};