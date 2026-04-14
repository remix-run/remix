import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { assetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  allow: ['app/client/**'],
  root: path.resolve(import.meta.dirname, '../..'),
  routes: [
    {
      urlPattern: `${assetsBase}/app/*path`,
      filePattern: 'app/client/*path',
    },
  ],
  watch: isDevelopment,
})
