import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    conditions: ['development'],
  },
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [
        {
          browser: 'chromium',
          headless: true,
        },
      ],
      screenshotFailures: false,
    },
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      enabled: false,
      provider: 'v8',
      all: false,
      reporter: ['text'],
      exclude: ['src/testing/**', '**/*.test.ts', '**/*.test.tsx'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
})
