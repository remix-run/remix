import { platform } from 'node:process'
import { defineConfig } from 'playwright/test'

export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // CI runs WebKit on macOS. Windows WebKit is a different port from Safari's.
    ...(platform === 'win32' || (process.env.CI === 'true' && platform === 'linux')
      ? []
      : [{ name: 'webkit', use: { browserName: 'webkit' as const } }]),
  ],
})
