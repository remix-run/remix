import assert from '@remix-run/assert'
import { describe, it, test } from '@remix-run/test'
import {
  getAffectedWorkspaceDirs,
  getChangedWorkspaceDirs,
  getFullRunReasons,
} from './workspaces.ts'
import type { WorkspaceInfo } from './workspaces.ts'

describe('getChangedWorkspaceDirs', () => {
  it('includes a nested benchmark and its enclosing package without a dependency edge', () => {
    let workspaces: WorkspaceInfo[] = [
      {
        dir: 'packages/component',
        name: '@remix-run/component',
        dependencies: [],
        scripts: ['test', 'typecheck'],
      },
      {
        dir: 'packages/component/bench',
        name: 'component-bench',
        dependencies: [],
        scripts: ['typecheck'],
      },
    ]

    assert.deepEqual(
      [...getChangedWorkspaceDirs(['packages/component/bench/runner.ts'], workspaces)].sort(),
      ['packages/component', 'packages/component/bench'],
    )
  })
})

test('getAffectedWorkspaceDirs includes reverse dependents across workspaces', () => {
  let workspaces: WorkspaceInfo[] = [
    {
      dir: 'packages/headers',
      name: '@remix-run/headers',
      dependencies: [],
      scripts: ['test', 'typecheck'],
    },
    {
      dir: 'packages/cookie',
      name: '@remix-run/cookie',
      dependencies: ['@remix-run/headers'],
      scripts: ['test', 'typecheck'],
    },
    {
      dir: 'docs/site',
      name: 'remix-docs',
      dependencies: ['remix'],
      scripts: ['typecheck'],
    },
    {
      dir: 'packages/remix',
      name: 'remix',
      dependencies: ['@remix-run/cookie'],
      scripts: ['test', 'typecheck'],
    },
  ]

  assert.deepEqual(getAffectedWorkspaceDirs(new Set(['packages/headers']), workspaces), [
    'docs/site',
    'packages/cookie',
    'packages/headers',
    'packages/remix',
  ])
})

describe('workspace test inputs', () => {
  it('includes the parent suite and dependents for a nested fixture without test scripts', () => {
    let workspaces: WorkspaceInfo[] = [
      { dir: 'packages/cli', name: '@remix-run/cli', dependencies: [], scripts: ['test'] },
      {
        dir: 'packages/cli/test/fixtures/routes-basic',
        name: 'routes-basic-fixture',
        dependencies: [],
        scripts: [],
      },
      {
        dir: 'demos/app',
        name: 'app',
        dependencies: ['@remix-run/cli'],
        scripts: ['test'],
      },
    ]
    let changed = getChangedWorkspaceDirs(
      ['packages/cli/test/fixtures/routes-basic/app/routes.ts'],
      workspaces,
    )
    let affected = getAffectedWorkspaceDirs(changed, workspaces)

    assert.deepEqual(
      workspaces
        .filter(
          (workspace) => affected.includes(workspace.dir) && workspace.scripts.includes('test'),
        )
        .map((workspace) => workspace.dir),
      ['packages/cli', 'demos/app'],
    )
  })

  it('includes CLI scaffolding tests when the app template changes', () => {
    let workspaces: WorkspaceInfo[] = [
      { dir: 'packages/cli', name: '@remix-run/cli', dependencies: [], scripts: ['test'] },
      { dir: 'template', name: 'remix-template', dependencies: [], scripts: ['test'] },
    ]

    assert.deepEqual(
      getAffectedWorkspaceDirs(
        getChangedWorkspaceDirs(['template/package.json'], workspaces),
        workspaces,
      ),
      ['packages/cli', 'template'],
    )
  })
})

describe('getFullRunReasons', () => {
  it('requires a full run for each shared configuration, script, and CI change', () => {
    for (let file of [
      'package.json',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'tsconfig.json',
      'tsconfig.shared.json',
      'scripts/run-changed-workspaces.ts',
      'scripts/utils/workspaces.ts',
      '.github/workflows/check-pr.yaml',
      '.github/actions/setup-node-pnpm-cache/action.yaml',
    ]) {
      assert.deepEqual(getFullRunReasons([file], []), [file])
    }
  })

  it('flags root-wide config changes and deleted workspace manifests', () => {
    let workspaces: WorkspaceInfo[] = [
      {
        dir: 'packages/headers',
        name: '@remix-run/headers',
        dependencies: [],
        scripts: ['test', 'typecheck'],
      },
    ]

    assert.deepEqual(
      getFullRunReasons(
        [
          'package.json',
          'playwright.config.ts',
          'playwright.config.js',
          'pnpm-lock.yaml',
          'packages/removed/package.json',
          'README.md',
        ],
        workspaces,
      ),
      [
        'package.json',
        'playwright.config.ts',
        'playwright.config.js',
        'pnpm-lock.yaml',
        'packages/removed/package.json',
      ],
    )
  })

  it('flags deleted nested workspace manifests even when a parent workspace still exists', () => {
    let parent: WorkspaceInfo = {
      dir: 'packages/component',
      name: '@remix-run/component',
      dependencies: [],
      scripts: ['test'],
    }
    assert.deepEqual(getFullRunReasons(['packages/component/removed/package.json'], [parent]), [
      'packages/component/removed/package.json',
    ])
  })
})
