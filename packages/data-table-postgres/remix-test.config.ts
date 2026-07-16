import type { RemixTestConfig } from '@remix-run/test'

export default {
  type: 'server',
  coverage: process.argv.includes('--coverage')
    ? {
        include: ['src/**/*.ts'],
        lines: 80,
        branches: 80,
        functions: 75,
        statements: 80,
      }
    : undefined,
} satisfies RemixTestConfig
