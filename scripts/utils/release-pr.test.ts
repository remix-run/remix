import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { PackageRelease } from './changes.ts'
import { generatePrBody, generatePrTitle } from './release-pr.ts'

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

describe('generatePrTitle', () => {
  it('uses the pending Remix version', () => {
    let title = generatePrTitle([
      makeRelease({
        packageDirName: 'assets',
        packageName: '@remix-run/assets',
        nextVersion: '0.6.0',
      }),
      makeRelease({
        packageDirName: 'remix',
        packageName: 'remix',
        nextVersion: '3.0.0-rc.1',
      }),
    ])

    assert.equal(title, 'Release v3.0.0-rc.1')
  })

  it('keeps the generic title for subpackage-only releases', () => {
    let title = generatePrTitle([
      makeRelease({
        packageDirName: 'assets',
        packageName: '@remix-run/assets',
        nextVersion: '0.6.0',
      }),
    ])

    assert.equal(title, 'Release')
  })
})

describe('generatePrBody', () => {
  it('counts change files by bump type and marks dependency-only releases as n/a', () => {
    let release = makeRelease({
      packageDirName: 'example',
      packageName: '@remix-run/example',
      nextVersion: '2.0.0',
    })
    release.changes = [
      { file: 'patch.fix.md', bump: 'patch', content: 'Fix a bug' },
      { file: 'minor.feature.md', bump: 'minor', content: 'Add a feature' },
      { file: 'major.breaking.md', bump: 'major', content: 'BREAKING CHANGE: Remove an API' },
      { file: 'minor.another-feature.md', bump: 'minor', content: 'Add another feature' },
    ]
    let dependent = makeRelease({
      packageDirName: 'dependent',
      packageName: '@remix-run/dependent',
      nextVersion: '1.0.1',
    })
    dependent.changes = []
    dependent.dependencyBumps = [
      {
        packageName: release.packageName,
        version: release.nextVersion,
        releaseUrl: 'https://github.com/remix-run/remix/releases/tag/example@2.0.0',
      },
    ]

    let body = generatePrBody([release, dependent])

    assert.ok(body.includes('| Package | Version | Change files |'))
    assert.ok(
      body.includes('| @remix-run/example | `1.0.0` → `2.0.0` | 1 major, 2 minor, 1 patch |'),
    )
    assert.ok(body.includes('| @remix-run/dependent | `1.0.0` → `1.0.1` | n/a |'))
  })

  it('puts remix first and sorts remaining packages alphabetically', () => {
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
})
