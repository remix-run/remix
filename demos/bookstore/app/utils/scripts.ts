import * as path from 'node:path'
import { createScriptServer } from 'remix/script-server'
import { scriptsBase } from '../routes.ts'

let repoRoot = path.resolve(import.meta.dirname, '../../../..')
let isDevelopment = process.env.NODE_ENV === 'development'

export let scriptServer = createScriptServer({
  root: repoRoot,
  routes: [
    {
      urlPattern: `${scriptsBase}/app/*path`,
      filePattern: 'demos/bookstore/app/*path',
    },
    {
      urlPattern: `${scriptsBase}/packages/*path`,
      filePattern: 'packages/*path',
    },
  ],
  allow: ['demos/bookstore/app/assets/**', 'demos/bookstore/app/routes.ts', 'packages/*/src/**'],
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: isDevelopment
    ? undefined
    : {
        buildId: process.env.GITHUB_SHA ?? String(Date.now()),
      },
})
