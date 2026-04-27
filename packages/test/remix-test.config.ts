import type { RemixTestConfig } from './src'

export default {
  coverage: {
    include: [
      'src/{app,lib}/**/*.{ts,tsx}',
      // Needed for coverage parity test
      'src/test/coverage/fixture.ts',
    ],
  },
  playwrightConfig: {
    projects: [
      {
        name: 'chromium',
        use: { browserName: 'chromium' },
      },
      {
        name: 'firefox',
        use: { browserName: 'firefox' },
      },
    ],
  },
} satisfies RemixTestConfig
