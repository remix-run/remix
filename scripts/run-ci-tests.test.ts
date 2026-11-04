import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as YAML from 'yaml'
import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { getTestShardWorkspaces, selectTestWorkspaces, testShardNames } from './run-ci-tests.ts'
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
    let workspaces = [workspace('packages/one'), workspace('docs/site')]
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
        workspaces,
        fullRunReasons: [file],
      })
    }
  })
})

describe('CI workflow test coverage', () => {
  it('schedules every test workspace exactly once and requires successful shard results', () => {
    let root = new URL('../', import.meta.url)
    let workflow = YAML.parseDocument(
      fs.readFileSync(new URL('.github/workflows/check-pr.yaml', root), 'utf8'),
    )
    let matrix = workflow.getIn(['jobs', 'test_ubuntu_shard', 'strategy', 'matrix', 'shard'])
    assert.ok(YAML.isSeq(matrix))
    assert.deepEqual(matrix.toJSON(), [...testShardNames])

    let workspaces = getWorkspaceInfos(fileURLToPath(root)).filter((workspace) =>
      workspace.scripts.includes('test'),
    )
    assert.ok(workspaces.length > 0)
    let scheduled = testShardNames.flatMap((shard) => getTestShardWorkspaces(workspaces, shard))
    assert.deepEqual(
      scheduled.map((workspace) => workspace.dir).sort(),
      workspaces.map((workspace) => workspace.dir).sort(),
    )

    assert.equal(workflow.getIn(['jobs', 'test_ubuntu', 'needs']), 'test_ubuntu_shard')
    assert.equal(workflow.getIn(['jobs', 'test_ubuntu', 'if']), 'always()')
    assert.equal(
      workflow.getIn(['jobs', 'test_ubuntu', 'steps', 0, 'env', 'TEST_RESULT']),
      '${{ needs.test_ubuntu_shard.result }}',
    )
    assert.equal(
      workflow.getIn(['jobs', 'test_ubuntu', 'steps', 0, 'run']),
      'test "$TEST_RESULT" = success',
    )
  })
})
