import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

import { assetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../../..'),
  allow: [
    'demos/data-model-forms/app/assets/**',
    'demos/data-model-forms/app/actions/registration/registration-form.ts',
    'demos/data-model-forms/app/actions/registration/styles.ts',
    'demos/data-model-forms/app/routes.ts',
    'packages/*/src/**',
  ],
  fileMap: {
    '/app/*path': 'demos/data-model-forms/app/*path',
    '/packages/*path': 'packages/*path',
  },
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: isDevelopment
    ? undefined
    : { buildId: process.env.GITHUB_SHA || String(Date.now()) },
  watch: false,
})
