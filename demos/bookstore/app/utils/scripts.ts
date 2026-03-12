import * as path from 'node:path'
import { createScriptHandler } from 'remix/script-handler'
import { scriptsBase } from '../routes.ts'

export let scriptHandler = createScriptHandler({
  root: path.resolve(import.meta.dirname, '../..'),
  workspaceRoot: path.resolve(import.meta.dirname, '../../../..'),
  entryPoints: ['app/assets/*.tsx'],
  base: scriptsBase,
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
})
