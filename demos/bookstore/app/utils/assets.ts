import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { assetsBase } from '../routes.ts'

const repoRoot = path.resolve(import.meta.dirname, '../../../..')
const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  root: repoRoot,
  routes: [
    {
      urlPattern: `${assetsBase}/app/*path`,
      filePattern: 'demos/bookstore/app/*path',
    },
    {
      urlPattern: `${assetsBase}/packages/*path`,
      filePattern: 'packages/*path',
    },
  ],
  allow: ['demos/bookstore/app/assets/**', 'demos/bookstore/app/routes.ts', 'packages/*/src/**'],
  fingerprint: isDevelopment
    ? undefined
    : { buildId: process.env.GITHUB_SHA ?? String(Date.now()) },
  scripts: {
    sourceMaps: isDevelopment ? 'external' : undefined,
    minify: !isDevelopment,
  },
})
