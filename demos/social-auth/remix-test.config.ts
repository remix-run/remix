import type { RemixTestConfig } from 'remix/test'

export default {
  // The social-auth tests operate on the same DB so running multiple tests in
  // concurrent workers can sometimes cause test failures
  concurrency: 1,
  setup: './test/setup.ts',
} satisfies RemixTestConfig
