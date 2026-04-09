import * as path from 'node:path'
import { createStyleServer } from 'remix/style-server'

import { stylesBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

export const styleServer = createStyleServer({
  root: path.resolve(import.meta.dirname, '../..'),
  routes: [
    {
      urlPattern: `${stylesBase}/*path`,
      filePattern: 'app/styles/*path',
    },
  ],
  minify: !isDevelopment,
  sourceMaps: isDevelopment ? 'external' : undefined,
  fingerprint: isDevelopment
    ? undefined
    : { buildId: process.env.GITHUB_SHA ?? String(Date.now()) },
})
