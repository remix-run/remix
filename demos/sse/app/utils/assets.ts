import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

import { assetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../../..'),
  allowFiles: ['demos/sse/app/routes.ts', 'demos/sse/app/**/public/**'],
  allowPackages: ['remix'],
  denyFiles: ['demos/sse/app/**/*.test.*'],
  mounts: {
    app: 'demos/sse/app',
    packages: 'packages',
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: !isDevelopment,
  watch: false,
})
