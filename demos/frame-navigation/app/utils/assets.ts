import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

import { assetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

export const assets = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../../..'),
  allowFiles: ['demos/frame-navigation/app/assets/**', 'demos/frame-navigation/app/routes.ts'],
  allowPackages: ['remix'],
  fileMap: {
    '/app/*path': 'demos/frame-navigation/app/*path',
    '/packages/*path': 'packages/*path',
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: isDevelopment
    ? undefined
    : { buildId: process.env.GITHUB_SHA || String(Date.now()) },
  watch: false,
})
