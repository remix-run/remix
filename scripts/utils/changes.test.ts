import * as fs from 'node:fs'
import * as path from 'node:path'
import assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import type { PackageRelease } from './changes.ts'
import { generateChangelogContent, getNextVersion, parseAllChangeFiles } from './changes.ts'
import { packagesDir } from './packages.ts'

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

function withTemporaryPackage(version: string, callback: (packageDirName: string) => void) {
  let packagePath = fs.mkdtempSync(path.join(path.resolve(packagesDir), 'changes-test-'))
  let packageDirName = path.basename(packagePath)
  let packageJsonPath = path.join(packagePath, 'package.json')

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(
      {
        name: `@remix-run/${packageDirName}`,
        version,
        type: 'module',
      },
      null,
      2,
    ) + '\n',
  )

  try {
    callback(packageDirName)
  } finally {
    fs.rmSync(packagePath, { recursive: true, force: true })
  }
}

describe('parseAllChangeFiles', () => {
  it('allows stable packages without .changes directories', () => {
    withTemporaryPackage('1.0.0', () => {
      let result = parseAllChangeFiles()

      if (!result.valid) {
        assert.fail('Expected a stable package without a .changes directory to validate')
      }
    })
  })

  it('requires prerelease packages without .changes directories to configure prerelease mode', () => {
    withTemporaryPackage('1.0.0-beta.1', (packageDirName) => {
      let result = parseAllChangeFiles()

      if (result.valid) {
        assert.fail('Expected a prerelease package without a .changes directory to fail validation')
      }

      let errors = result.errors.filter((error) => error.packageDirName === packageDirName)

      assert.equal(errors.length, 1)
      assert.equal(errors[0]?.file, '.changes/config.json')
      assert.match(errors[0]?.error ?? '', /no \.changes\/config\.json exists/)
    })
  })
})

describe('generateChangelogContent', () => {
  it('groups prerelease changes into a single section', () => {
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

  it('keeps stable releases grouped by bump type', () => {
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
})

describe('getNextVersion', () => {
  it('starts prereleases from the next major version', () => {
    assert.equal(getNextVersion('2.17.4', 'major', { prereleaseChannel: 'alpha' }), '3.0.0-alpha.0')
  })

  it('increments prereleases within the same channel', () => {
    assert.equal(
      getNextVersion('3.0.0-alpha.0', 'patch', { prereleaseChannel: 'alpha' }),
      '3.0.0-alpha.1',
    )
  })
})
