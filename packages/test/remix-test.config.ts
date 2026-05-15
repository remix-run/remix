import type { RemixTestConfig } from './src/index.ts'

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
  },
} satisfies RemixTestConfig
