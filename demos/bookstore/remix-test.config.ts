import type { RemixTestConfig } from 'remix/test'
import type { PlaywrightTestConfig } from 'playwright/test'
import { platform } from 'node:process'

const projects: NonNullable<PlaywrightTestConfig['projects']> = [
  {
    name: 'chromium',
    use: { browserName: 'chromium' },
  },
]

if (platform !== 'win32') {
  projects.push({
    name: 'firefox',
    use: { browserName: 'firefox' },
  })
}

export default {
  ...(platform === 'win32'
    ? {
        // node:sqlite crashes after the bookstore e2e worker exits on Windows.
        // Keep Windows coverage on concurrent server/browser tests until that stabilizes.
        type: 'server,browser',
      }
    : {}),
  playwrightConfig: {
    projects,
    use: {
      navigationTimeout: 5_000,
      actionTimeout: 5_000,
    },
  },
} satisfies RemixTestConfig
