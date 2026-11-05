import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { getWorkspaceInfos } from './utils/workspaces.ts'

const refs = process.argv.slice(2)
if (refs.length !== 0 && refs.length !== 2) {
  throw new Error('Usage: pnpm test:browser [base-ref head-ref]')
}

const rootDir = process.cwd()
const workspaces = getWorkspaceInfos(rootDir).filter(
  (workspace) =>
    workspace.scripts.includes('test') &&
    ['playwright.config.ts', 'playwright.config.js'].some((file) =>
      fs.existsSync(path.join(rootDir, workspace.dir, file)),
    ),
)

let selectedWorkspaces = workspaces

if (refs.length === 2) {
  // check-pr.yaml runs
  let changedFiles = cp
    .execFileSync(
      'git',
      ['diff', '--name-only', '--no-renames', '-z', `${refs[0]}...${refs[1]}`, '--', '.'],
      { encoding: 'utf8' },
    )
    .split('\0')
    .filter(Boolean)

  selectedWorkspaces = selectedWorkspaces.filter((workspace) =>
    changedFiles.some((file) => file.startsWith(`${workspace.dir}/`)),
  )
}

if (selectedWorkspaces.length === 0) {
  console.log('No browser workspaces selected. Skipping browser tests.')
  process.exit(0)
}

const args = ['--recursive', '--no-sort', '--workspace-concurrency=4', '--stream']
for (let workspace of selectedWorkspaces) {
  args.push('--filter', `./${workspace.dir}`)
}
args.push('run', 'test', '--type', 'browser', '--type', 'e2e')

const result = cp.spawnSync('pnpm', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.exit(result.status ?? 1)
