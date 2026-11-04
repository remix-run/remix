import { platform } from 'node:process'
import { defineConfig } from 'playwright/test'

export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // Playwright's Windows WebKit is a different port from Safari's, so macOS and Linux cover it.
    ...(platform === 'win32' ? [] : [{ name: 'webkit', use: { browserName: 'webkit' as const } }]),
  ],
})
