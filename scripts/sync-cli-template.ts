import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanCliTemplate, syncCliTemplate } from './utils/cli-template.ts'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [command, ...extraArgs] = process.argv.slice(2)

if (extraArgs.length > 0 || (command != null && command !== '--clean')) {
  throw new Error('Usage: node ./scripts/sync-cli-template.ts [--clean]')
}

if (command === '--clean') {
  await cleanCliTemplate(rootDir)
} else {
  await syncCliTemplate(rootDir)
}
