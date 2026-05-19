module.exports = {
  preset: 'jest-expo',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|expo(nent)?|@expo|@unimodules|@rnmapbox|react-clone-referenced-element|@react-native-community|msw)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**/_layout.tsx',
  ],
};
