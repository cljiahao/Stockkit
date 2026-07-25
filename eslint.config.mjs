import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';
import sonarjs from 'eslint-plugin-sonarjs';

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    plugins: { sonarjs },
    rules: {
      // Honour the `_`-prefix convention for intentionally-unused args/vars.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Comment hygiene: own-line comments only, no commented-out code. See templatecentral:standards code-standards/comments.md.
      'no-inline-comments': [
        'error',
        { ignorePattern: 'eslint-|@ts-|prettier-|c8 |istanbul |webpackChunkName' },
      ],
      'sonarjs/no-commented-code': 'error',
    },
  },
  {
    // Tests and one-off scripts routinely label table-driven cases and
    // fixtures with short trailing notes; that reads better inline, so the
    // gate would be pure noise there.
    files: ['**/*.test.{ts,tsx}', '**/test/**', 'scripts/**'],
    rules: {
      'no-inline-comments': 'off',
      'sonarjs/no-commented-code': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      '.claude/**',
      'coverage/**',
      'supabase/**',
    ],
  },
];

export default config;
