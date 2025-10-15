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
    },
    include: ['src/**/*.test.ts'],
  },
})
