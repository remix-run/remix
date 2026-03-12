import * as path from 'node:path'
import { createScriptHandler } from 'remix/script-handler'
import { scriptsBase } from '../routes.ts'

export let scriptHandler = createScriptHandler({
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
