import type { RemixTestConfig } from '@remix-run/test'

export default {
  coverage: process.argv.includes('--coverage')
    ? {
        include: ['src/**/*.{ts,tsx}'],
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      }
    : false,
  glob: {
    test: '**/*.test.{ts,tsx}',
    // Same glob - all test files are browser test files
    browser: '**/*.test.{ts,tsx}',
  },
} satisfies RemixTestConfig
