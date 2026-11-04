import * as fs from 'node:fs'
import * as YAML from 'yaml'
import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import {
  getTestShardWorkspaces,
  isTestShard,
  selectTestWorkspaces,
  testShardNames,
} from './run-ci-tests.ts'
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

  it('runs all test workspaces for root configuration changes', () => {
    let workspaces = [workspace('packages/one'), workspace('docs/site')]
    assert.deepEqual(selectTestWorkspaces(['pnpm-lock.yaml'], workspaces), {
      workspaces,
      fullRunReasons: ['pnpm-lock.yaml'],
    })
  })

  it('runs all test workspaces for shared scripts and CI changes', () => {
    let workspaces = [workspace('packages/one'), workspace('docs/site')]
    let changedFiles = ['scripts/run-ci-tests.ts', '.github/workflows/check-pr.yaml']
    assert.deepEqual(selectTestWorkspaces(changedFiles, workspaces), {
      workspaces,
      fullRunReasons: changedFiles,
    })
  })

  it('skips unowned documentation and workspaces without test scripts', () => {
    let noTests = { ...workspace('docs/example'), scripts: ['typecheck'] }
    assert.deepEqual(selectTestWorkspaces(['README.md', 'docs/example/README.md'], [noTests]), {
      workspaces: [],
      fullRunReasons: [],
    })
  })
})

describe('CI test shards', () => {
  it('assigns browser packages, applications, and other workspaces without overlap', () => {
    let component = workspace('packages/component', '@remix-run/component')
    let assets = workspace('packages/assets', '@remix-run/assets')
    let app = workspace('demos/example')
    let docs = workspace('docs/ui')
    let template = workspace('template')
    let server = workspace('packages/headers')
    let workspaces = [component, assets, app, docs, template, server]
    assert.deepEqual(getTestShardWorkspaces(workspaces, 'browser'), [component, assets])
    assert.deepEqual(getTestShardWorkspaces(workspaces, 'apps'), [app, docs, template])
    assert.deepEqual(getTestShardWorkspaces(workspaces, 'other'), [server])
  })

  it('keeps all HMR test types and browser projects together', () => {
    let hmr = workspace('packages/component-hmr', '@remix-run/component-hmr')
    assert.deepEqual(getTestShardWorkspaces([hmr], 'hmr'), [hmr])
    assert.deepEqual(getTestShardWorkspaces([hmr], 'other'), [])
  })

  it('does not schedule absent HMR workspaces or workspaces without tests', () => {
    let noTests = { ...workspace('packages/no-tests'), scripts: ['build'] }
    assert.deepEqual(getTestShardWorkspaces([noTests], 'other'), [])
    assert.deepEqual(getTestShardWorkspaces([noTests], 'hmr'), [])
  })

  it('validates shard names so an unknown shard cannot silently skip tests', () => {
    assert.equal(isTestShard('browser'), true)
    assert.equal(isTestShard('hmr'), true)
    assert.equal(isTestShard('missing'), false)
  })
})

describe('CI workflow test coverage', () => {
  it('runs every supported shard and requires successful shard results', () => {
    let workflow = YAML.parseDocument(
      fs.readFileSync(new URL('../.github/workflows/check-pr.yaml', import.meta.url), 'utf8'),
    )
    let matrix = workflow.getIn(['jobs', 'test_ubuntu_shard', 'strategy', 'matrix', 'shard'])
    assert.ok(YAML.isSeq(matrix))
    assert.deepEqual(matrix.toJSON(), [...testShardNames])
    assert.equal(workflow.getIn(['jobs', 'test_ubuntu', 'needs']), 'test_ubuntu_shard')
    assert.equal(workflow.getIn(['jobs', 'test_ubuntu', 'if']), 'always()')
    assert.equal(
      workflow.getIn(['jobs', 'test_ubuntu', 'steps', 0, 'run']),
      'test "$TEST_RESULT" = success',
    )
  })
})
