import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { assetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../..'),
  allow: ['app/client/**'],
  fileMap: {
    '/app/*path': 'app/client/*path',
  },
  watch: isDevelopment,
})
