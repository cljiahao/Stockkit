import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    passWithNoTests: true,
    // Windows' default 'forks' pool occasionally crashes a worker process
    // outright ("Worker exited unexpectedly") under load, failing the whole
    // run despite every individual test passing. 'threads' avoids spawning
    // separate child processes and hasn't shown the same instability.
    pool: 'threads',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.{test,spec}.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/index.ts'],
    },
  },
});
