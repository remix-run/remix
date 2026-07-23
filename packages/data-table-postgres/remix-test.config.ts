import type { RemixTestConfig } from '@remix-run/test'

export default {
  type: 'server',
  coverage: process.argv.includes('--coverage')
    ? {
        include: ['src/**/*.ts'],
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      }
    : undefined,
} satisfies RemixTestConfig
