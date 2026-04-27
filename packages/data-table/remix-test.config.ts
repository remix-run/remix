import type { RemixTestConfig } from '@remix-run/test'

export default {
  type: 'server',
  // Only enable coverage when we pass the --coverage CLI flag
  coverage: process.argv.includes('--coverage')
    ? {
        include: [
          'src/lib/errors.ts',
          'src/lib/inflection.ts',
          'src/lib/migrations.ts',
          'src/lib/operators.ts',
          'src/lib/references.ts',
          'src/lib/sql.ts',
        ],
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      }
    : undefined,
} satisfies RemixTestConfig
