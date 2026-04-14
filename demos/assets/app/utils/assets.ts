import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  allow: ['app/client/**'],
  root: path.resolve(import.meta.dirname, '../..'),
  routes: [{ urlPattern: '/assets/app/*path', filePattern: 'app/client/*path' }],
  watch: isDevelopment,
})
