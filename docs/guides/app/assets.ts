import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { docsAssetHmrOptions } from 'remix-docs-shared/hmr/assets'

import { assetsBase } from './routes.ts'

const nodeEnv = process.env.NODE_ENV ?? 'production'
const isDevelopment = nodeEnv === 'development'
const isProduction = nodeEnv === 'production'
const { hmr, scriptLoaders, watch } = docsAssetHmrOptions

export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../..'),
  allowFiles: [
    'docs/guides/app/routes.ts',
    'docs/guides/app/**/public/**',
    'docs/shared/**/public/**',
  ],
  allowPackages: ['@remix-run/ui', 'remix'],
  denyFiles: ['**/*.test.*'],
  mounts: {
    app: 'docs/guides/app',
    'docs-shared': 'docs/shared',
    npm: 'node_modules',
    packages: 'packages',
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: isProduction,
  fingerprint: isProduction,
  watch,
  hmr,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
    loaders: scriptLoaders,
  },
})

const scriptEntryPath = path.resolve(import.meta.dirname, 'actions/public/entry.ts')
const stylesheetEntry = path.resolve(import.meta.dirname, 'actions/public/docs.css')

export const scriptEntry = await assetServer.getScriptEntry(scriptEntryPath)
export const stylesheetHref = await assetServer.getHref(stylesheetEntry)
export const stylesheetPreloads = await assetServer.getPreloads(stylesheetEntry)
export const importMap = await assetServer.getImportMap(scriptEntryPath)
