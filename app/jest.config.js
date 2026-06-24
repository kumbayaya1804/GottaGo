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
    '!src/app/**',                 // Placeholder screens — E2E/integration tested from Phase 3
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
