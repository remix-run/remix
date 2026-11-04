import { platform } from 'node:process'
import { defineConfig } from 'playwright/test'

export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // Windows runs Chromium only. Playwright's Windows WebKit is a different port from Safari's,
    // so macOS and Linux cover WebKit.
    ...(platform === 'win32'
      ? []
      : [
          { name: 'firefox', use: { browserName: 'firefox' as const } },
          { name: 'webkit', use: { browserName: 'webkit' as const } },
        ]),
  ],
})
