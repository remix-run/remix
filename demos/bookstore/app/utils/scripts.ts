import * as path from 'node:path'
import { createScriptHandler } from 'remix/script-handler'

let scriptHandler = createScriptHandler({
  root: path.resolve(import.meta.dirname, '../..'),
  workspaceRoot: '../..',
  entryPoints: ['app/entry.tsx', 'app/assets/*.tsx'],
  base: '/scripts',
})

export { scriptHandler }
