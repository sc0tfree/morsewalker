import js from '@eslint/js';

const browserGlobals = {
  AudioContext: 'readonly',
  Event: 'readonly',
  KeyboardEvent: 'readonly',
  console: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  localStorage: 'readonly',
  setTimeout: 'readonly',
  window: 'readonly',
  yourState: 'readonly',
};

const nodeGlobals = {
  Buffer: 'readonly',
  URL: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  process: 'readonly',
  setTimeout: 'readonly',
};

export default [
  {
    ignores: ['coverage/**', 'dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['tests/**/*.{js,mjs}', '*.config.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...browserGlobals,
        ...nodeGlobals,
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
