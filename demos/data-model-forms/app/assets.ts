import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

import { assetsBase } from './routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../..'),
  allowFiles: ['demos/data-model-forms/app/**/public/**', 'demos/data-model-forms/app/routes.ts'],
  allowPackages: ['remix', '@remix-run/ui'],
  denyFiles: ['demos/data-model-forms/app/**/*.test.*'],
  mounts: {
    app: 'demos/data-model-forms/app',
    npm: 'node_modules',
    packages: 'packages',
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: !isDevelopment,
  watch: false,
})
