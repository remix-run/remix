import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

import { assetsBase } from './routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../..'),
  allowFiles: [
    'demos/data-model-forms/app/assets/**',
    'demos/data-model-forms/app/actions/registration/registration-form.ts',
    'demos/data-model-forms/app/actions/registration/styles.ts',
    'demos/data-model-forms/app/data/account-schema.ts',
    'demos/data-model-forms/app/routes.ts',
  ],
  allowPackages: ['remix', '@remix-run/ui'],
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
