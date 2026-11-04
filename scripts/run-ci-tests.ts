import * as cp from 'node:child_process'
import {
  getAffectedWorkspaceDirs,
  getChangedWorkspaceDirs,
  getFullRunReasons,
  getWorkspaceInfos,
} from './utils/workspaces.ts'
import type { WorkspaceInfo } from './utils/workspaces.ts'

export const testShardNames = ['browser', 'apps', 'other', 'hmr'] as const
export type TestShard = (typeof testShardNames)[number]

const browserPackages = new Set([
  '@remix-run/assets',
  '@remix-run/component',
  '@remix-run/multiple-import-maps-polyfill',
  '@remix-run/ui',
])

function main() {
  let [shard, baseRef, headRef] = process.argv.slice(2)
  if (process.argv.length !== 5 || shard == null || !isTestShard(shard) || !baseRef || !headRef) {
    throw new Error('Usage: node scripts/run-ci-tests.ts <shard> <base-ref> <head-ref>')
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

  let workspaces = getTestShardWorkspaces(selection.workspaces, shard)
  if (workspaces.length === 0) {
    console.log(`No affected tests for shard "${shard}". Skipping.`)
    return
  }

  console.log(`Running tests for shard "${shard}":`)
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

export function isTestShard(value: string): value is TestShard {
  return testShardNames.some((shard) => shard === value)
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

export function getTestShardWorkspaces(
  workspaces: WorkspaceInfo[],
  shard: TestShard,
): WorkspaceInfo[] {
  return workspaces.filter(
    (workspace) => workspace.scripts.includes('test') && getWorkspaceShard(workspace) === shard,
  )
}

function getWorkspaceShard(workspace: WorkspaceInfo): TestShard {
  if (workspace.name === '@remix-run/component-hmr') return 'hmr'
  if (browserPackages.has(workspace.name)) return 'browser'
  if (
    workspace.dir.startsWith('demos/') ||
    workspace.dir.startsWith('docs/') ||
    workspace.dir === 'template'
  ) {
    return 'apps'
  }
  return 'other'
}

if (import.meta.main) main()
