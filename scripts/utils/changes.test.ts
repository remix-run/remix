import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PackageRelease } from './changes.ts'
import { generateChangelogContent } from './changes.ts'

function makeRelease(overrides: Partial<PackageRelease> = {}): PackageRelease {
  return {
    packageDirName: 'remix',
    packageName: 'remix',
    currentVersion: '3.0.0-alpha.3',
    nextVersion: '3.0.0-alpha.4',
    bump: 'patch',
    changes: [],
    dependencyBumps: [],
    ...overrides,
  }
}

test('generateChangelogContent groups prerelease changes into a single section', () => {
  let content = generateChangelogContent(
    makeRelease({
      changes: [
        {
          file: 'minor.alpha.md',
          bump: 'minor',
          content: 'Alpha change',
        },
        {
          file: 'major.breaking.md',
          bump: 'major',
          content: 'BREAKING CHANGE: Breaking change',
        },
        {
          file: 'patch.fix.md',
          bump: 'patch',
          content: 'Patch change',
        },
      ],
      dependencyBumps: [
        {
          packageName: '@remix-run/router',
          version: '1.2.3',
          releaseUrl: 'https://example.com/router',
        },
      ],
    }),
  )

  assert.match(content, /^## v3\.0\.0-alpha\.4/m)
  assert.match(content, /^### Pre-release Changes$/m)
  assert.doesNotMatch(content, /^### Major Changes$/m)
  assert.doesNotMatch(content, /^### Minor Changes$/m)
  assert.doesNotMatch(content, /^### Patch Changes$/m)
  assert.match(content, /- BREAKING CHANGE: Breaking change/)
  assert.match(content, /- Alpha change/)
  assert.match(content, /- Patch change/)
  assert.match(content, /- Bumped `@remix-run\/\*` dependencies:/)
  assert.match(content, /\[`router@1\.2\.3`\]\(https:\/\/example\.com\/router\)/)
})

test('generateChangelogContent keeps stable releases grouped by bump type', () => {
  let content = generateChangelogContent(
    makeRelease({
      currentVersion: '3.0.0',
      nextVersion: '3.0.1',
      changes: [
        {
          file: 'minor.feature.md',
          bump: 'minor',
          content: 'Feature change',
        },
      ],
      dependencyBumps: [
        {
          packageName: '@remix-run/router',
          version: '1.2.3',
          releaseUrl: 'https://example.com/router',
        },
      ],
    }),
  )

  assert.match(content, /^## v3\.0\.1/m)
  assert.match(content, /^### Minor Changes$/m)
  assert.match(content, /^### Patch Changes$/m)
  assert.doesNotMatch(content, /^### Pre-release Changes$/m)
})
