import { platform } from 'node:process'
import type { PlaywrightTestProject } from 'playwright/test'
import { defineConfig } from 'playwright/test'

let projects: PlaywrightTestProject[]

if (process.env.CI !== 'true' || platform === 'win32') {
  projects = [{ name: 'chromium', use: { browserName: 'chromium' } }]
} else if (platform === 'linux') {
  projects = [{ name: 'chromium', use: { browserName: 'chromium' } }]
} else {
  projects = [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ]
}

export default defineConfig({ projects })
