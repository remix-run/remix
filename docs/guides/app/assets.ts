import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

import { assetsBase } from './routes.ts'

const nodeEnv = process.env.NODE_ENV ?? 'production'
const isDevelopment = nodeEnv === 'development'
const isProduction = nodeEnv === 'production'

export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../..'),
  allowFiles: [
    'docs/guides/app/routes.ts',
    'docs/guides/app/**/public/**',
    'docs/shared/**/public/**',
  ],
  allowPackages: ['remix'],
  denyFiles: ['**/*.test.*'],
  mounts: {
    app: 'docs/guides/app',
    'docs-shared': 'docs/shared',
    packages: 'packages',
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: isProduction,
  fingerprint: isProduction ? { buildId: process.env.GITHUB_SHA || String(Date.now()) } : undefined,
  watch: false,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
  },
})

const scriptEntry = path.resolve(import.meta.dirname, 'actions/public/entry.ts')
const devRefreshScriptEntry = path.resolve(import.meta.dirname, 'actions/public/dev-refresh.ts')
const stylesheetEntry = path.resolve(import.meta.dirname, 'actions/public/docs.css')

export const scriptSrc = await assetServer.getHref(scriptEntry)
export const scriptPreloads = await assetServer.getPreloads(scriptEntry)
export const stylesheetHref = await assetServer.getHref(stylesheetEntry)
export const stylesheetPreloads = await assetServer.getPreloads(stylesheetEntry)
export const devRefreshScriptSrc = isProduction
  ? undefined
  : await assetServer.getHref(devRefreshScriptEntry)
