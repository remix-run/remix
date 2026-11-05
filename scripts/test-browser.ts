import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { getWorkspaceInfos } from './utils/workspaces.ts'

const refs = process.argv.slice(2)
if (refs.length !== 0 && refs.length !== 2) {
  throw new Error('Usage: pnpm test:browser [base-ref head-ref]')
}

const rootDir = process.cwd()
const configFiles = ['playwright.config.ts', 'playwright.config.js']
const workspaces = getWorkspaceInfos(rootDir).filter(
  (workspace) =>
    workspace.scripts.includes('test') &&
    configFiles.some((file) => fs.existsSync(path.join(rootDir, workspace.dir, file))),
)

if (refs.length === 2) {
  let [baseRef, headRef] = refs
  let changedFiles = cp
    .execFileSync(
      'git',
      ['diff', '--name-only', '--no-renames', '-z', `${baseRef}...${headRef}`, '--', '.'],
      {
        encoding: 'utf8',
      },
    )
    .split('\0')
    .filter(Boolean)
  let browserWorkspaceChanged = changedFiles.some(
    (file) =>
      workspaces.some((workspace) => file.startsWith(`${workspace.dir}/`)) ||
      configFiles.some((config) => file.endsWith(`/${config}`)),
  )
  if (!browserWorkspaceChanged) {
    console.log('No browser workspace changes. Skipping browser tests.')
    process.exit(0)
  }
}

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
