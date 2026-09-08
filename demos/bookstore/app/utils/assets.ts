import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { uiHmr } from 'remix/ui-hmr/assets'
import { assetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

export const assets = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../../..'),
  allowFiles: ['demos/bookstore/app/routes.ts', 'demos/bookstore/app/**/public/**'],
  allowPackages: ['remix'],
  denyFiles: ['demos/bookstore/app/**/*.test.*'],
  mounts: {
    app: 'demos/bookstore/app',
    npm: 'node_modules',
    packages: 'packages',
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: !isDevelopment,
  watch: isDevelopment,
  hmr: isHmr
    ? {
        channel: async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
        moduleImporter: 'remix/multiple-import-maps-polyfill',
      }
    : undefined,
  scripts: {
    loaders: isHmr ? [uiHmr()] : undefined,
  },
})
