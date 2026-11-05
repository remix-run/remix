import { platform } from 'node:process'
import type { PlaywrightTestProject } from 'playwright/test'
import { defineConfig } from 'playwright/test'

let projects: PlaywrightTestProject[]

if (process.env.CI !== 'true' || platform === 'win32') {
  // Local development, Windows
  projects = [{ name: 'chromium', use: { browserName: 'chromium' } }]
} else if (platform === 'darwin') {
  // OSX
  projects = [{ name: 'webkit', use: { browserName: 'webkit' } }]
} else {
  // Ubuntu CI
  projects = [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ]
}

export default defineConfig({ projects })
