import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parsePackagePath,
  resolveVersion,
  isFullyResolvedVersion,
  getFilesAtPath,
  PackageNotFoundError,
  VersionNotFoundError,
  InvalidPathError,
  type PackageMetadata,
  type PackageFile,
} from './npm.ts'

describe('parsePackagePath', () => {
  it('parses simple package name', () => {
    let result = parsePackagePath('lodash')
    assert.deepEqual(result, { name: 'lodash', version: 'latest', filePath: '' })
  })

  it('parses package name with version', () => {
    let result = parsePackagePath('lodash@4.17.21')
    assert.deepEqual(result, { name: 'lodash', version: '4.17.21', filePath: '' })
  })

  it('parses package name with partial version', () => {
    let result = parsePackagePath('react@18')
    assert.deepEqual(result, { name: 'react', version: '18', filePath: '' })
  })

  it('parses package with file path', () => {
    let result = parsePackagePath('lodash/package.json')
    assert.deepEqual(result, { name: 'lodash', version: 'latest', filePath: 'package.json' })
  })

  it('parses package with version and file path', () => {
    let result = parsePackagePath('lodash@4.17.21/package.json')
    assert.deepEqual(result, { name: 'lodash', version: '4.17.21', filePath: 'package.json' })
  })

  it('parses package with nested file path', () => {
    let result = parsePackagePath('lodash@4/lib/utils.js')
    assert.deepEqual(result, { name: 'lodash', version: '4', filePath: 'lib/utils.js' })
  })

  it('parses scoped package name', () => {
    let result = parsePackagePath('@remix-run/cookie')
    assert.deepEqual(result, { name: '@remix-run/cookie', version: 'latest', filePath: '' })
  })

  it('parses scoped package with version', () => {
    let result = parsePackagePath('@remix-run/cookie@1.0.0')
    assert.deepEqual(result, { name: '@remix-run/cookie', version: '1.0.0', filePath: '' })
  })

  it('parses scoped package with file path', () => {
    let result = parsePackagePath('@remix-run/cookie/src/index.ts')
    assert.deepEqual(result, {
      name: '@remix-run/cookie',
      version: 'latest',
      filePath: 'src/index.ts',
    })
  })

  it('parses scoped package with version and file path', () => {
    let result = parsePackagePath('@remix-run/cookie@1.0.0/src/lib/cookie.ts')
    assert.deepEqual(result, {
      name: '@remix-run/cookie',
      version: '1.0.0',
      filePath: 'src/lib/cookie.ts',
    })
  })

  it('throws for invalid scoped package path', () => {
    assert.throws(() => parsePackagePath('@remix-run'), {
      name: 'InvalidPathError',
    })
  })

  it('parses URL-encoded caret semver range', () => {
    let result = parsePackagePath('react@%5E18.2')
    assert.deepEqual(result, { name: 'react', version: '^18.2', filePath: '' })
  })

  it('parses URL-encoded tilde semver range', () => {
    let result = parsePackagePath('lodash@%7E4.17')
    assert.deepEqual(result, { name: 'lodash', version: '~4.17', filePath: '' })
  })

  it('parses unencoded semver range', () => {
    let result = parsePackagePath('react@^18.2')
    assert.deepEqual(result, { name: 'react', version: '^18.2', filePath: '' })
  })
})

describe('resolveVersion', () => {
  let mockMetadata: PackageMetadata = {
    name: 'test-package',
    'dist-tags': {
      latest: '2.0.0',
      beta: '3.0.0-beta.1',
      next: '2.1.0-alpha.1',
    },
    versions: {
      '1.0.0': {
        name: 'test-package',
        version: '1.0.0',
        dist: { tarball: 'http://example.com/1.0.0.tgz', shasum: 'abc' },
      },
      '1.0.1': {
        name: 'test-package',
        version: '1.0.1',
        dist: { tarball: 'http://example.com/1.0.1.tgz', shasum: 'def' },
      },
      '1.1.0': {
        name: 'test-package',
        version: '1.1.0',
        dist: { tarball: 'http://example.com/1.1.0.tgz', shasum: 'ghi' },
      },
      '2.0.0': {
        name: 'test-package',
        version: '2.0.0',
        dist: { tarball: 'http://example.com/2.0.0.tgz', shasum: 'jkl' },
      },
      '3.0.0-beta.1': {
        name: 'test-package',
        version: '3.0.0-beta.1',
        dist: { tarball: 'http://example.com/3.0.0-beta.1.tgz', shasum: 'mno' },
      },
      '2.1.0-alpha.1': {
        name: 'test-package',
        version: '2.1.0-alpha.1',
        dist: { tarball: 'http://example.com/2.1.0-alpha.1.tgz', shasum: 'pqr' },
      },
    },
  }

  it('resolves dist-tag to version', () => {
    assert.equal(resolveVersion(mockMetadata, 'latest'), '2.0.0')
    assert.equal(resolveVersion(mockMetadata, 'beta'), '3.0.0-beta.1')
    assert.equal(resolveVersion(mockMetadata, 'next'), '2.1.0-alpha.1')
  })

  it('resolves exact version', () => {
    assert.equal(resolveVersion(mockMetadata, '1.0.0'), '1.0.0')
    assert.equal(resolveVersion(mockMetadata, '2.0.0'), '2.0.0')
  })

  it('resolves partial major version to highest match', () => {
    assert.equal(resolveVersion(mockMetadata, '1'), '1.1.0')
  })

  it('resolves partial major.minor version to highest match', () => {
    assert.equal(resolveVersion(mockMetadata, '1.0'), '1.0.1')
  })

  it('throws for non-existent version', () => {
    assert.throws(() => resolveVersion(mockMetadata, '5.0.0'), {
      name: 'VersionNotFoundError',
    })
  })

  it('throws for non-existent partial version', () => {
    assert.throws(() => resolveVersion(mockMetadata, '4'), {
      name: 'VersionNotFoundError',
    })
  })

  it('resolves caret range to highest matching version', () => {
    assert.equal(resolveVersion(mockMetadata, '^1.0.0'), '1.1.0')
  })

  it('resolves tilde range to highest matching version', () => {
    assert.equal(resolveVersion(mockMetadata, '~1.0.0'), '1.0.1')
  })

  it('resolves greater-than-or-equal range', () => {
    assert.equal(resolveVersion(mockMetadata, '>=1.0.0'), '2.0.0')
  })

  it('resolves complex semver range', () => {
    assert.equal(resolveVersion(mockMetadata, '>=1.0.0 <2.0.0'), '1.1.0')
  })

  it('throws for semver range with no matching version', () => {
    assert.throws(() => resolveVersion(mockMetadata, '^5.0.0'), {
      name: 'VersionNotFoundError',
    })
  })
})

describe('isFullyResolvedVersion', () => {
  let mockMetadata: PackageMetadata = {
    name: 'test-package',
    'dist-tags': {
      latest: '2.0.0',
    },
    versions: {
      '1.0.0': {
        name: 'test-package',
        version: '1.0.0',
        dist: { tarball: 'http://example.com/1.0.0.tgz', shasum: 'abc' },
      },
      '2.0.0': {
        name: 'test-package',
        version: '2.0.0',
        dist: { tarball: 'http://example.com/2.0.0.tgz', shasum: 'def' },
      },
    },
  }

  it('returns true for exact version in versions', () => {
    assert.equal(isFullyResolvedVersion(mockMetadata, '1.0.0'), true)
    assert.equal(isFullyResolvedVersion(mockMetadata, '2.0.0'), true)
  })

  it('returns false for dist-tag', () => {
    assert.equal(isFullyResolvedVersion(mockMetadata, 'latest'), false)
  })

  it('returns false for partial version', () => {
    assert.equal(isFullyResolvedVersion(mockMetadata, '1'), false)
    assert.equal(isFullyResolvedVersion(mockMetadata, '1.0'), false)
  })

  it('returns false for semver range', () => {
    assert.equal(isFullyResolvedVersion(mockMetadata, '^1.0.0'), false)
    assert.equal(isFullyResolvedVersion(mockMetadata, '~1.0.0'), false)
    assert.equal(isFullyResolvedVersion(mockMetadata, '>=1.0.0'), false)
  })

  it('returns false for non-existent version', () => {
    assert.equal(isFullyResolvedVersion(mockMetadata, '3.0.0'), false)
  })
})

describe('getFilesAtPath', () => {
  let mockFiles: Map<string, PackageFile> = new Map([
    ['dist', { name: 'dist', path: 'dist', size: 0, type: 'directory' }],
    ['src', { name: 'src', path: 'src', size: 0, type: 'directory' }],
    ['LICENSE', { name: 'LICENSE', path: 'LICENSE', size: 1024, type: 'file' }],
    ['package.json', { name: 'package.json', path: 'package.json', size: 512, type: 'file' }],
    ['README.md', { name: 'README.md', path: 'README.md', size: 2048, type: 'file' }],
    ['src/index.ts', { name: 'index.ts', path: 'src/index.ts', size: 256, type: 'file' }],
    ['src/lib', { name: 'lib', path: 'src/lib', size: 0, type: 'directory' }],
    ['src/lib/utils.ts', { name: 'utils.ts', path: 'src/lib/utils.ts', size: 128, type: 'file' }],
    ['dist/index.js', { name: 'index.js', path: 'dist/index.js', size: 384, type: 'file' }],
    ['dist/index.d.ts', { name: 'index.d.ts', path: 'dist/index.d.ts', size: 192, type: 'file' }],
  ])

  it('lists root level files and directories', () => {
    let files = getFilesAtPath(mockFiles, '')
    assert.equal(files.length, 5)
    // Directories first, then alphabetically
    assert.deepEqual(
      files.map((f) => f.name),
      ['dist', 'src', 'LICENSE', 'package.json', 'README.md'],
    )
  })

  it('lists files in src directory', () => {
    let files = getFilesAtPath(mockFiles, 'src')
    assert.equal(files.length, 2)
    assert.deepEqual(
      files.map((f) => f.name),
      ['lib', 'index.ts'],
    )
  })

  it('lists files in nested directory', () => {
    let files = getFilesAtPath(mockFiles, 'src/lib')
    assert.equal(files.length, 1)
    assert.equal(files[0].name, 'utils.ts')
  })

  it('lists files in dist directory', () => {
    let files = getFilesAtPath(mockFiles, 'dist')
    assert.equal(files.length, 2)
    assert.deepEqual(
      files.map((f) => f.name),
      ['index.d.ts', 'index.js'],
    )
  })

  it('returns empty for non-existent directory', () => {
    let files = getFilesAtPath(mockFiles, 'nonexistent')
    assert.equal(files.length, 0)
  })

  it('handles trailing slash in path', () => {
    let files = getFilesAtPath(mockFiles, 'src/')
    assert.equal(files.length, 2)
  })

  it('handles leading slash in path', () => {
    let files = getFilesAtPath(mockFiles, '/src')
    assert.equal(files.length, 2)
  })

  it('sorts directories before files', () => {
    let files = getFilesAtPath(mockFiles, '')
    let dirCount = files.filter((f) => f.type === 'directory').length
    assert.equal(dirCount, 2)
    // First 2 should be directories
    assert.equal(files[0].type, 'directory')
    assert.equal(files[1].type, 'directory')
    // Rest should be files
    assert.equal(files[2].type, 'file')
  })
})

describe('Error classes', () => {
  it('PackageNotFoundError has correct properties', () => {
    let error = new PackageNotFoundError('my-package')
    assert.equal(error.name, 'PackageNotFoundError')
    assert.equal(error.packageName, 'my-package')
    assert.equal(error.message, 'Package not found: my-package')
  })

  it('VersionNotFoundError has correct properties', () => {
    let error = new VersionNotFoundError('my-package', '5.0.0')
    assert.equal(error.name, 'VersionNotFoundError')
    assert.equal(error.packageName, 'my-package')
    assert.equal(error.version, '5.0.0')
    assert.equal(error.message, 'Version not found: my-package@5.0.0')
  })

  it('InvalidPathError has correct properties', () => {
    let error = new InvalidPathError('@incomplete')
    assert.equal(error.name, 'InvalidPathError')
    assert.equal(error.path, '@incomplete')
    assert.equal(error.message, 'Invalid package path: @incomplete')
  })
})
