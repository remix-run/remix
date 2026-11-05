import type { PlaywrightTestProject } from 'playwright/test'
import { defineConfig } from 'playwright/test'

let projects: PlaywrightTestProject[]

if (process.env.CI === 'true') {
  projects = [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ]
} else {
  projects = [{ name: 'chromium', use: { browserName: 'chromium' } }]
}

export default defineConfig({ projects })
