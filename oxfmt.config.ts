import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 100,
  semi: false,
  singleQuote: true,
  useTabs: false,
  sortPackageJson: false,
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'tmp/',
    'reference/',
    '**/*.bundled.*',
    '**/public/assets/',
    '**/test/fixtures/',
    '**/worker-configuration.d.ts',
    'pnpm-lock.yaml',
  ],
})
