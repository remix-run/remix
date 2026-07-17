import * as path from 'node:path'

import { createAssetServer } from 'remix/assets'

import { assetsBase } from '../routes.ts'

const nodeEnv = process.env.NODE_ENV ?? 'development'
const isDevelopment = nodeEnv === 'development'
const isProduction = nodeEnv === 'production'
const rootDir = path.resolve(import.meta.dirname, '../../../..')

export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir,
  fileMap: {
    '/app/*path': 'docs/guides/app/*path',
    '/docs-shared/*path': 'docs/shared/*path',
    '/packages/*path': 'packages/*path',
  },
  allow: [
    'docs/guides/app/routes.ts',
    'docs/guides/app/**/*.browser.ts?(x)',
    'docs/guides/app/**/*.demo.ts?(x)',
    'docs/guides/app/styles/**/*.css',
    'docs/shared/**/*.browser.ts?(x)',
    'packages/*/src/**',
  ],
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: isProduction,
  fingerprint: isProduction ? { buildId: process.env.GITHUB_SHA || String(Date.now()) } : undefined,
  watch: isDevelopment,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
  },
})
