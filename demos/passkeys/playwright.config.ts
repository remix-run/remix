import { defineConfig } from 'playwright/test'

// The end-to-end test signs in with a virtual authenticator, which only Chromium exposes through
// the Chrome DevTools Protocol.
export default defineConfig({
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
