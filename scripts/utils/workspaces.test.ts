import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  getAffectedWorkspaceDirs,
  getChangedWorkspaceDirs,
  getFullRunReasons,
} from './workspaces.ts'
import type { WorkspaceInfo } from './workspaces.ts'

test('getChangedWorkspaceDirs prefers the most specific nested workspace', () => {
  let workspaces: WorkspaceInfo[] = [
    {
      dir: 'packages/component',
      name: '@remix-run/component',
      dependencies: [],
      scripts: ['test', 'typecheck'],
    },
    {
      dir: 'packages/component/demos',
      name: 'component-demos',
      dependencies: ['@remix-run/component'],
      scripts: ['typecheck'],
    },
  ]

  assert.deepEqual(
    [...getChangedWorkspaceDirs(['packages/component/demos/app/root.tsx'], workspaces)],
    ['packages/component/demos'],
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
      dir: 'docs',
      name: 'remix-the-docs',
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
    'docs',
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
