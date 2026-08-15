import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';
import sonarjs from 'eslint-plugin-sonarjs';

const config = [
  ...coreWebVitals,
  ...typescript,
  sonarjs.configs.recommended,
  {
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
      // sonarjs.configs.recommended ships this rule 'off'; this repo's comment-hygiene
      // doctrine (AGENTS.md) requires it as a hard error.
      'sonarjs/no-commented-code': 'error',
    },
  },
  {
    // Generated shadcn primitives — CLI-managed, not hand-authored to this rule.
    files: ['src/components/ui/**'],
    rules: {
      'sonarjs/prefer-read-only-props': 'off',
    },
  },
  {
    // Tests and one-off scripts routinely label table-driven cases and
    // fixtures with short trailing notes; that reads better inline, so the
    // gate would be pure noise there. Fixtures also use fake secrets/URLs
    // that sonarjs's security rules would otherwise false-positive on.
    files: ['**/*.test.{ts,tsx}', '**/test/**', 'scripts/**'],
    rules: {
      'no-inline-comments': 'off',
      'sonarjs/no-commented-code': 'off',
      'sonarjs/no-hardcoded-secrets': 'off',
      'sonarjs/no-clear-text-protocols': 'off',
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
      '.worktrees/**',
    ],
  },
];

export default config;
