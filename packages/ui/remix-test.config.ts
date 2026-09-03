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
    test: ['**/*.test.{ts,tsx}', '**/*.test.e2e.{ts,tsx}'],
    browser: '**/*.test.{ts,tsx}',
    e2e: '**/*.test.e2e.{ts,tsx}',
  },
  playwrightConfig: {
    projects: [
      {
        name: 'chromium',
        use: { browserName: 'chromium' },
      },
    ],
  },
} satisfies RemixTestConfig
