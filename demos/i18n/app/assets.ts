import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

import { assetsBase } from './routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../..'),
  allowFiles: ['demos/i18n/app/routes.ts', 'demos/i18n/app/**/public/**'],
  allowPackages: ['remix'],
  denyFiles: ['demos/i18n/app/**/*.test.*'],
  mounts: {
    app: 'demos/i18n/app',
    packages: 'packages',
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: isProduction,
  fingerprint: isProduction ? { buildId: process.env.GITHUB_SHA || String(Date.now()) } : undefined,
  watch: isDevelopment,
})

const scriptEntry = path.resolve(import.meta.dirname, 'actions/public/entry.ts')

export const scriptSrc = await assetServer.getHref(scriptEntry)
export const scriptPreloads = await assetServer.getPreloads(scriptEntry)
