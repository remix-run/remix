import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { assetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  rootDir: path.resolve(import.meta.dirname, '../../../..'),
  allow: ['demos/bookstore/app/assets/**', 'demos/bookstore/app/routes.ts', 'packages/*/src/**'],
  fileMap: {
    [`${assetsBase}/app/*path`]: 'demos/bookstore/app/*path',
    [`${assetsBase}/packages/*path`]: 'packages/*path',
  },
  scripts: {
    sourceMaps: isDevelopment ? 'external' : undefined,
    minify: !isDevelopment,
  },
  fingerprint: isDevelopment
    ? undefined
    : { buildId: process.env.GITHUB_SHA || String(Date.now()) },
  watch: false,
})
