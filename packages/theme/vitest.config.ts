import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    conditions: ['development'],
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
