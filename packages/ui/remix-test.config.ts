import type { RemixTestConfig } from '@remix-run/test'
import { glob } from 'fs/promises'

export default {
  // All component tests run in the browser. Match `.test.{ts,tsx}` rather than
  // the default `.test.browser.{ts,tsx}` so we don't have to rename any files.
  glob: {
    test: 'src/**/*.test.{ts,tsx}',
    browser: 'src/**/*.test.{ts,tsx}',
  },
} satisfies RemixTestConfig
