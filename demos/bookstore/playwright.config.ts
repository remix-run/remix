import { platform } from 'node:process'
import type { PlaywrightTestProject } from 'playwright/test'
import { defineConfig } from 'playwright/test'

let projects: PlaywrightTestProject[]

if (platform === 'win32') {
  projects = [{ name: 'chromium', use: { browserName: 'chromium' } }]
} else if (process.env.CI === 'true' && platform === 'linux') {
  projects = [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ]
} else {
  projects = [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ]
}

export default defineConfig({ projects })
