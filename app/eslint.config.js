const expo = require('eslint-config-expo/flat');

module.exports = [
  ...expo,
  {
    settings: {
      react: { version: '19.0' },
    },
  },
  {
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    ignores: ['dist/**', '.expo/**', 'android/**', 'node_modules/**'],
  },
];
