import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { uiHmr } from 'remix/ui-hmr/assets'
import { assetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

export const assets = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../../..'),
  allowFiles: ['demos/record-store/app/routes.ts', 'demos/record-store/app/**/public/**'],
  allowPackages: ['remix'],
  denyFiles: ['demos/record-store/app/**/*.test.*'],
  mounts: {
    app: 'demos/record-store/app',
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
