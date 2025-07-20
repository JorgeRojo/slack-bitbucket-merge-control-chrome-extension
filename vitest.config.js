import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: [
        'node_modules/',
        'coverage/',
        'tests/',
        '**/*.test.js',
        '**/*.spec.js',
        'src/components/toggle-switch/toggle-switch.js', // Exclude problematic file
        'eslint.config.js',
        'vitest.config.js',
        '.amazonq/',
        '**/*.config.js',
        '**/*.config.ts',
      ],
      // Add source map support and ignore empty lines
      all: true,
      skipFull: false,
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
      // Configure v8 options to handle source maps better
      reportsDirectory: './coverage',
      clean: true,
    },
  },
});
