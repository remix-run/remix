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
  // better-sqlite3 may crash on Windows when this demo opens in-memory
  // databases across multiple test workers or browser project runs.
  concurrency: 1,
  playwrightConfig: {
    projects,
    use: {
      navigationTimeout: 5_000,
      actionTimeout: 5_000,
    },
  },
} satisfies RemixTestConfig
