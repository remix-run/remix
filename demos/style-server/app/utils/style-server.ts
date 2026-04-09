import * as path from 'node:path'
import { createStyleServer } from 'remix/style-server'

const isDevelopment = process.env.NODE_ENV === 'development'

export const styleServer = createStyleServer({
  root: path.resolve(import.meta.dirname, '../..'),
  routes: [{ urlPattern: '/styles/*path', filePattern: 'app/styles/*path' }],
  watch: isDevelopment,
  minify: !isDevelopment,
  sourceMaps: isDevelopment ? 'external' : undefined,
  fingerprint: isDevelopment
    ? undefined
    : { buildId: process.env.GITHUB_SHA ?? String(Date.now()) },
})
