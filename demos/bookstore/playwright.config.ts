import { platform } from 'node:process'
import { defineConfig } from 'playwright/test'

export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // Windows runs Chromium only.
    ...(platform === 'win32'
      ? []
      : [
          { name: 'firefox', use: { browserName: 'firefox' as const } },
          // CI runs WebKit on macOS.
          ...(process.env.CI === 'true' && platform === 'linux'
            ? []
            : [{ name: 'webkit', use: { browserName: 'webkit' as const } }]),
        ]),
  ],
})
