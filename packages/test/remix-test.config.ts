import { devices } from '@playwright/test'
import type { RemixTestConfig } from './src'

export default {
  playwrightConfig: {
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
      },
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'], browserName: 'firefox' },
      },
    ],
  },
} satisfies RemixTestConfig
