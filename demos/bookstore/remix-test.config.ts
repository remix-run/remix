import type { RemixTestConfig } from 'remix/test'

export default {
  // better-sqlite3 may crash on Windows when this demo opens many in-memory
  // databases across test workers concurrently.
  concurrency: 1,
  playwrightConfig: {
    projects: [
      {
        name: 'chromium',
        use: { browserName: 'chromium' },
      },
      {
        name: 'firefox',
        use: { browserName: 'firefox' },
      },
    ],
    use: {
      navigationTimeout: 5_000,
      actionTimeout: 5_000,
    },
  },
} satisfies RemixTestConfig
