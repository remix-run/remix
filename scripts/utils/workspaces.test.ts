import assert from '@remix-run/assert'
import { test } from '@remix-run/test'
import {
  getAffectedWorkspaceDirs,
  getChangedWorkspaceDirs,
  getFullRunReasons,
} from './workspaces.ts'
import type { WorkspaceInfo } from './workspaces.ts'

test('getChangedWorkspaceDirs prefers the most specific nested workspace', () => {
  let workspaces: WorkspaceInfo[] = [
    {
      dir: 'packages/ui',
      name: '@remix-run/ui',
      dependencies: [],
      scripts: ['test', 'typecheck'],
    },
    {
      dir: 'packages/ui/demo',
      name: 'ui-demos',
      dependencies: ['@remix-run/ui'],
      scripts: ['typecheck'],
    },
  ]

  assert.deepEqual(
    [...getChangedWorkspaceDirs(['packages/ui/demo/app/root.tsx'], workspaces)],
    ['packages/ui/demo'],
  )
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
      dir: 'docs/api',
      name: 'remix-api',
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
    'docs/api',
    'packages/cookie',
    'packages/headers',
    'packages/remix',
  ])
})

test('getFullRunReasons flags root-wide config changes and deleted workspace manifests', () => {
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
      ['package.json', 'pnpm-lock.yaml', 'packages/removed/package.json', 'README.md'],
      workspaces,
    ),
    ['package.json', 'pnpm-lock.yaml', 'packages/removed/package.json'],
  )
})
