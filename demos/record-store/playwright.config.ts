import { platform } from 'node:process'
import { defineConfig } from 'playwright/test'

export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    ...(platform === 'win32'
      ? []
      : [{ name: 'firefox', use: { browserName: 'firefox' as const } }]),
  ],
})
