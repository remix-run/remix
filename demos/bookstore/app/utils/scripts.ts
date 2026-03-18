import * as path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createFsFileStorage } from 'remix/file-storage/fs'
import { createScriptServer } from 'remix/script-server'
import { scriptsBase } from '../routes.ts'

let repoRoot = path.resolve(import.meta.dirname, '../../../..')
let scriptServerStorage = createFsFileStorage(
  path.resolve(import.meta.dirname, '..', '..', 'tmp', 'script-server'),
)
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
  entryPoints: ['demos/bookstore/app/assets/*.tsx'],
  allow: ['demos/bookstore/app/**', 'packages/**'],
  fileStorage: scriptServerStorage,
  fingerprintInternalModules: !isDevelopment,
  internalModuleCacheControl: isDevelopment ? 'no-cache' : 'public, max-age=31536000',
  minify: !isDevelopment,
  sourceMaps: isDevelopment ? 'external' : undefined,
  version: isDevelopment ? '' : (process.env.GITHUB_SHA ?? randomUUID()),
})
