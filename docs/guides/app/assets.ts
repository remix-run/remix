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
  fileMap: {
    '/app/*path': 'docs/guides/app/*path',
    '/docs-shared/*path': 'docs/shared/*path',
    '/packages/*path': 'packages/*path',
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: isProduction,
  fingerprint: isProduction,
  watch: false,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
  },
})

const scriptEntryPath = path.resolve(import.meta.dirname, 'actions/public/entry.ts')
const devRefreshScriptEntry = path.resolve(import.meta.dirname, 'actions/public/dev-refresh.ts')
const stylesheetEntry = path.resolve(import.meta.dirname, 'actions/public/docs.css')

export const scriptEntry = await assetServer.getScriptEntry(scriptEntryPath)
export const stylesheetHref = await assetServer.getHref(stylesheetEntry)
export const stylesheetPreloads = await assetServer.getPreloads(stylesheetEntry)
export const devRefreshScript = isProduction
  ? undefined
  : await assetServer.getScriptEntry(devRefreshScriptEntry)
