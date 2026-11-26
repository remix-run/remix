import { spawnSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { getWorkspaceInfos } from './utils/workspaces.ts'

let [stage, concurrency] = process.argv.slice(2)
let rootDir = process.cwd()
let workspaces = getWorkspaceInfos(rootDir).filter(
  (workspace) =>
    workspace.scripts.includes('test') &&
    ['playwright.config.ts', 'playwright.config.js'].some((file) =>
      fs.existsSync(path.join(rootDir, workspace.dir, file)),
    ),
)
let args = [
  '--recursive',
  '--no-sort',
  '--no-bail',
  `--workspace-concurrency=${concurrency}`,
  '--stream',
]
for (let workspace of workspaces) args.push('--filter', `./${workspace.dir}`)
args.push('run', 'test', '--type', 'browser', '--type', 'e2e')
console.log(JSON.stringify({ stage, concurrency, workspaces: workspaces.map((entry) => entry.dir) }))
let result = spawnSync(
  process.execPath,
  ['scripts/hmr-performance-run.mjs', stage, 'pnpm', ...args],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
