import type { RemixTestConfig } from './src'

export default {
  coverage: {
    include: ['src/**/*.{ts,tsx}'],
  },
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
