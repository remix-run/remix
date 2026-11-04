import { fileURLToPath } from 'node:url'
import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { selectTestWorkspaces } from './run-ci-tests.ts'
import { getWorkspaceInfos } from './utils/workspaces.ts'
import type { WorkspaceInfo } from './utils/workspaces.ts'

function workspace(dir: string, name = dir, dependencies: string[] = []): WorkspaceInfo {
  return { dir, name, dependencies, scripts: ['test'] }
}

describe('CI test workspace selection', () => {
  it('includes changed workspaces and their transitive dependents', () => {
    let owner = workspace('packages/cors-middleware', '@remix-run/cors-middleware')
    let remix = workspace('packages/remix', 'remix', [owner.name])
    let app = workspace('demos/example', 'example', [remix.name])
    let unrelated = workspace('packages/unrelated')
    assert.deepEqual(
      selectTestWorkspaces(
        ['packages/cors-middleware/src/index.ts'],
        [owner, remix, app, unrelated],
      ),
      { workspaces: [owner, remix, app], fullRunReasons: [] },
    )
  })

  it('runs all test workspaces for shared configuration, scripts, and CI changes', () => {
    let workspaces = getWorkspaceInfos(fileURLToPath(new URL('../', import.meta.url)))
    let testWorkspaces = workspaces.filter((workspace) => workspace.scripts.includes('test'))
    assert.ok(testWorkspaces.length > 0)
    for (let file of [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.json',
      'tsconfig.shared.json',
      'scripts/run-ci-tests.ts',
      'scripts/utils/workspaces.ts',
      '.github/workflows/check-pr.yaml',
      '.github/actions/setup-node-pnpm-cache/action.yaml',
    ]) {
      assert.deepEqual(selectTestWorkspaces([file], workspaces), {
        workspaces: testWorkspaces,
        fullRunReasons: [file],
      })
    }
  })
})
