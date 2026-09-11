import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

import { assetsBase } from './routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../..'),
  allowFiles: ['demos/i18n/app/routes.ts', 'demos/i18n/app/**/public/**'],
  allowPackages: ['i18next', 'remix'],
  denyFiles: ['demos/i18n/app/**/*.test.*'],
  mounts: {
    app: 'demos/i18n/app',
    npm: 'node_modules',
    packages: 'packages',
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: isProduction,
  fingerprint: isProduction,
  watch: isDevelopment,
})

const entry = path.resolve(import.meta.dirname, 'actions/public/entry.ts')

export const scriptEntry = await assetServer.getScriptEntry(entry)
