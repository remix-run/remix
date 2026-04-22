import type { RemixTestConfig } from 'remix/test'

export default {
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
