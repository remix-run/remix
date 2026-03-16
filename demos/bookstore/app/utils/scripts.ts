import * as path from 'node:path'
import { createScriptServer } from 'remix/script-server'
import { scriptsBase } from '../routes.ts'

export let scriptServer = createScriptServer({
  base: scriptsBase,
  roots: [
    {
      directory: path.resolve(import.meta.dirname, '../..'),
      entryPoints: ['app/assets/*.tsx'],
    },
    {
      prefix: 'packages',
      directory: path.resolve(import.meta.dirname, '../../../../packages'),
    },
  ],
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
})
