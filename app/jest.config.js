module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo|@unimodules|@rnmapbox|react-clone-referenced-element|@react-native-community|msw)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/lib/database.types.ts', // Supabase-generated, not behavioral
    '!src/app/**',  // Screens excluded from coverage collection — testable auth logic lives in src/features/** at 100% coverage; src/app/** screens are TDD-tested but excluded per CONTEXT §10 / Open Q6
  ],
  coverageThreshold: {
    global: {
      lines: 100,
      branches: 100,
      functions: 100,
      statements: 100,
    },
  },
};
