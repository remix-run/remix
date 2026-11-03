import {
  getAffectedWorkspaceDirs,
  getChangedWorkspaceDirs,
  getFullRunReasons,
} from './workspaces.ts'
import type { WorkspaceInfo } from './workspaces.ts'

export const testShardNames = ['browser', 'apps', 'other', 'hmr'] as const
export type TestShard = (typeof testShardNames)[number]

const browserPackages = new Set([
  '@remix-run/assets',
  '@remix-run/component',
  '@remix-run/multiple-import-maps-polyfill',
  '@remix-run/ui',
])

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
