import * as cp from 'node:child_process'
import {
  getAffectedWorkspaceDirs,
  getChangedWorkspaceDirs,
  getFullRunReasons,
  getWorkspaceInfos,
} from './utils/workspaces.ts'
import type { WorkspaceInfo } from './utils/workspaces.ts'

function main() {
  let [baseRef, headRef] = process.argv.slice(2)
  if (process.argv.length !== 4 || !baseRef || !headRef) {
    throw new Error('Usage: node scripts/run-ci-tests.ts <base-ref> <head-ref>')
  }

  let changedFiles = cp
    .execFileSync('git', ['diff', '--name-only', '-z', `${baseRef}...${headRef}`], {
      encoding: 'utf8',
    })
    .split('\0')
    .filter(Boolean)
  let selection = selectTestWorkspaces(changedFiles, getWorkspaceInfos(process.cwd()))

  if (selection.fullRunReasons.length > 0) {
    console.log(`Running all test workspaces because shared files changed:`)
    for (let reason of selection.fullRunReasons) console.log(`- ${reason}`)
  }

  let workspaces = selection.workspaces
  if (workspaces.length === 0) {
    console.log('No affected test workspaces. Skipping.')
    return
  }

  console.log('Running tests in affected workspaces:')
  for (let workspace of workspaces) console.log(`- ${workspace.dir} (${workspace.name})`)

  let args = [
    '--recursive',
    '--no-sort',
    '--workspace-concurrency=4',
    '--stream',
    ...workspaces.flatMap((workspace) => ['--filter', `./${workspace.dir}`]),
    'run',
    'test',
  ]
  let result = cp.spawnSync('pnpm', args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

export function selectTestWorkspaces(
  changedFiles: string[],
  workspaces: WorkspaceInfo[],
): { workspaces: WorkspaceInfo[]; fullRunReasons: string[] } {
  let fullRunReasons = getFullRunReasons(changedFiles, workspaces)
  let affectedDirs = new Set(
    getAffectedWorkspaceDirs(getChangedWorkspaceDirs(changedFiles, workspaces), workspaces),
  )

  return {
    workspaces: workspaces.filter(
      (workspace) =>
        workspace.scripts.includes('test') &&
        (fullRunReasons.length > 0 || affectedDirs.has(workspace.dir)),
    ),
    fullRunReasons,
  }
}

if (import.meta.main) main()
