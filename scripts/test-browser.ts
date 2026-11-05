import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { getWorkspaceInfos } from './utils/workspaces.ts'

const rootDir = process.cwd()
const workspaces = getWorkspaceInfos(rootDir).filter(
  (workspace) =>
    workspace.scripts.includes('test') &&
    ['playwright.config.ts', 'playwright.config.js'].some((file) =>
      fs.existsSync(path.join(rootDir, workspace.dir, file)),
    ),
)

if (workspaces.length === 0) {
  throw new Error('No browser test workspaces found')
}

const args = ['--recursive', '--no-sort', '--workspace-concurrency=4', '--stream']
for (let workspace of workspaces) {
  args.push('--filter', `./${workspace.dir}`)
}
args.push('run', 'test', '--type', 'browser', '--type', 'e2e')

const result = cp.spawnSync('pnpm', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
