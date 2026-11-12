// @ts-check
// One ESLint config for the whole monorepo (flat config).
// Layer boundaries from design section 4.1 and 8 are enforced with `no-restricted-imports`.
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/** Modules that must never appear in pure code (engine, schemas). */
const IO_AND_UI = [
  {
    group: ['react', 'react-dom', 'react/*', 'next', 'next/*'],
    message: 'Pure packages have no UI. (design 4.1)',
  },
  {
    group: ['axios', '@prisma/*', 'pino', '@opentelemetry/*'],
    message: 'Pure packages have no I/O. (design 4.1)',
  },
  {
    group: ['node:*', 'fs', 'path', 'http', 'https', 'net', 'child_process'],
    message: 'Pure packages run in the browser too.',
  },
  { group: ['@sit/web', '@sit/web/*'], message: 'Packages never import the app.' },
];

/** Things UI components must not reach for directly. */
const UI_FORBIDDEN = [
  {
    group: ['@prisma/*'],
    message: 'Components never call Prisma. Use a server component or the API. (design 4.1)',
  },
  {
    group: ['axios'],
    message: 'Components use query hooks; only lib/api calls Axios. (design 9.3)',
  },
  { group: ['@/server', '@/server/*'], message: 'Server code is not importable from components.' },
];

const restrict = (/** @type {Array<{group: string[], message: string}>} */ patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/coverage/**',
    '**/reports/**',
    '**/dist/**',
    '**/next-env.d.ts',
    'packages/db/src/generated/**',
    'apps/web/public/vendor/**',
    'apps/web/storybook-static/**',
  ]),
  {
    settings: { next: { rootDir: 'apps/web/' } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  // ---- Pure packages -------------------------------------------------------
  {
    files: ['packages/engine/src/**/*.ts'],
    ignores: ['packages/engine/src/**/*.test.ts'],
    rules: {
      ...restrict(IO_AND_UI),
      // design 6.1: no I/O, no dates, no randomness, no globals
      'no-restricted-globals': [
        'error',
        'process',
        'window',
        'document',
        'localStorage',
        'fetch',
        'Date',
        'setTimeout',
        'setInterval',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'The engine is deterministic.' },
      ],
    },
  },
  { files: ['packages/engine/test/**'], rules: { 'no-console': 'off' } },
  {
    // Dev tools that drive the untyped prototype code (parity check, golden generator).
    files: ['packages/engine/tools/**'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['packages/schemas/src/**/*.ts'],
    rules: restrict([
      ...IO_AND_UI,
      { group: ['@sit/engine', '@sit/engine/*'], message: 'Schemas do not depend on the engine.' },
    ]),
  },
  // ---- Component layers (design 8: ui → patterns → features) ---------------
  {
    files: ['apps/web/components/ui/**/*.{ts,tsx}'],
    rules: restrict([
      ...UI_FORBIDDEN,
      {
        group: ['@/components/patterns/*', '@/components/features/*'],
        message: 'Layer 2 (ui) cannot import layers 3–4.',
      },
    ]),
  },
  {
    files: ['apps/web/components/patterns/**/*.{ts,tsx}'],
    rules: restrict([
      ...UI_FORBIDDEN,
      {
        group: ['@/components/features/*'],
        message: 'Layer 3 (patterns) is domain-free; it cannot import features.',
      },
    ]),
  },
  { files: ['apps/web/components/features/**/*.{ts,tsx}'], rules: restrict(UI_FORBIDDEN) },
  // ---- Scripts and config files may log ------------------------------------
  {
    files: [
      'scripts/**',
      'apps/web/scripts/**',
      'packages/db/src/seed.ts',
      'deploy/**',
      '**/*.config.{js,mjs,ts}',
    ],
    rules: { 'no-console': 'off' },
  },
]);
