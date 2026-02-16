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
  },
})
