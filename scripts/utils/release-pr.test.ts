import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PackageRelease } from './changes.ts'
import { generatePrBody } from './release-pr.ts'

function makeRelease({
  packageDirName,
  packageName,
  nextVersion,
}: {
  packageDirName: string
  packageName: string
  nextVersion: string
}): PackageRelease {
  return {
    packageDirName,
    packageName,
    currentVersion: '1.0.0',
    nextVersion,
    bump: 'patch',
    changes: [{ file: 'patch.test-change.md', bump: 'patch', content: 'Test change' }],
    dependencyBumps: [],
  }
}

test('generatePrBody puts remix first and sorts remaining packages alphabetically', () => {
  let body = generatePrBody([
    makeRelease({
      packageDirName: 'zeta',
      packageName: '@remix-run/zeta',
      nextVersion: '1.0.1',
    }),
    makeRelease({
      packageDirName: 'remix',
      packageName: 'remix',
      nextVersion: '3.0.0',
    }),
    makeRelease({
      packageDirName: 'beta',
      packageName: '@remix-run/beta',
      nextVersion: '1.0.1',
    }),
    makeRelease({
      packageDirName: 'alpha',
      packageName: '@remix-run/alpha',
      nextVersion: '1.0.1',
    }),
  ])

  let remixTableIndex = body.indexOf('| remix |')
  let alphaTableIndex = body.indexOf('| @remix-run/alpha |')
  let betaTableIndex = body.indexOf('| @remix-run/beta |')
  let zetaTableIndex = body.indexOf('| @remix-run/zeta |')

  assert.notEqual(remixTableIndex, -1)
  assert.notEqual(alphaTableIndex, -1)
  assert.notEqual(betaTableIndex, -1)
  assert.notEqual(zetaTableIndex, -1)
  assert.ok(remixTableIndex < alphaTableIndex)
  assert.ok(alphaTableIndex < betaTableIndex)
  assert.ok(betaTableIndex < zetaTableIndex)

  let remixChangelogIndex = body.indexOf('## remix v3.0.0')
  let alphaChangelogIndex = body.indexOf('## @remix-run/alpha v1.0.1')
  let betaChangelogIndex = body.indexOf('## @remix-run/beta v1.0.1')
  let zetaChangelogIndex = body.indexOf('## @remix-run/zeta v1.0.1')

  assert.notEqual(remixChangelogIndex, -1)
  assert.notEqual(alphaChangelogIndex, -1)
  assert.notEqual(betaChangelogIndex, -1)
  assert.notEqual(zetaChangelogIndex, -1)
  assert.ok(remixChangelogIndex < alphaChangelogIndex)
  assert.ok(alphaChangelogIndex < betaChangelogIndex)
  assert.ok(betaChangelogIndex < zetaChangelogIndex)
})
