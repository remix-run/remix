import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import {
  absolutePathToPublicPath,
  normalizeRootPrefix,
  resolveAbsolutePathFromResolvedRoots,
  resolvePublicPathFromResolvedRoots,
  toPosixPath,
} from './path-utils.ts'

describe('toPosixPath', () => {
  it('returns the path unchanged on POSIX systems', () => {
    assert.equal(toPosixPath('/foo/bar/baz.ts'), '/foo/bar/baz.ts')
  })

  it('splits on path.sep and joins with forward slashes', () => {
    let sep = '\\'
    let p = `foo${sep}bar${sep}baz.ts`
    let result = p.split(sep).join('/')
    assert.equal(result, 'foo/bar/baz.ts')
  })

  it('handles a path with no separators', () => {
    assert.equal(toPosixPath('file.ts'), 'file.ts')
  })

  it('handles empty string', () => {
    assert.equal(toPosixPath(''), '')
  })
})

describe('normalizeRootPrefix', () => {
  it('returns null when prefix is omitted', () => {
    assert.equal(normalizeRootPrefix(), null)
  })

  it('treats empty or whitespace-only prefix as no prefix', () => {
    assert.equal(normalizeRootPrefix(''), null)
    assert.equal(normalizeRootPrefix('   '), null)
  })

  it('trims and strips leading or trailing slashes', () => {
    assert.equal(normalizeRootPrefix(' /packages/ui/ '), 'packages/ui')
  })

  it('rejects backslashes', () => {
    assert.throws(() => normalizeRootPrefix('packages\\ui'))
  })

  it('rejects dot segments', () => {
    assert.throws(() => normalizeRootPrefix('./packages'))
    assert.throws(() => normalizeRootPrefix('../packages'))
  })
})

describe('root path resolution', () => {
  let tmpDir: string
  let appRoot: string
  let packagesRoot: string
  let roots: Array<{ prefix: string | null; directory: string }>

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'path-utils-test-'))
    appRoot = path.join(tmpDir, 'project')
    packagesRoot = path.join(tmpDir, 'packages')
    await fs.mkdir(path.join(appRoot, 'app/utils'), { recursive: true })
    await fs.mkdir(path.join(packagesRoot, 'shared/src'), { recursive: true })
    await fs.writeFile(path.join(appRoot, 'app/utils/helper.ts'), '')
    await fs.writeFile(path.join(packagesRoot, 'shared/src/index.ts'), '')
    roots = [
      { prefix: 'packages', directory: packagesRoot },
      { prefix: null, directory: appRoot },
    ]
  })

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  describe('resolveAbsolutePathFromResolvedRoots', () => {
    it('returns the public path for a file directly in the fallback root', () => {
      let filePath = path.join(appRoot, 'app/utils/helper.ts')
      let result = resolveAbsolutePathFromResolvedRoots(filePath, roots)
      assert.ok(result)
      assert.equal(result.publicPath, 'app/utils/helper.ts')
      assert.equal(result.relativePath, 'app/utils/helper.ts')
      assert.equal(result.resolvedRoot.prefix, null)
    })

    it('returns a prefixed public path for a file inside a prefixed root', () => {
      let filePath = path.join(packagesRoot, 'shared/src/index.ts')
      let result = resolveAbsolutePathFromResolvedRoots(filePath, roots)
      assert.ok(result)
      assert.equal(result.publicPath, 'packages/shared/src/index.ts')
      assert.equal(result.relativePath, 'shared/src/index.ts')
      assert.equal(result.resolvedRoot.prefix, 'packages')
    })

    it('returns null when the file is outside every configured root', () => {
      let outsideFile = path.join(os.tmpdir(), 'outside.ts')
      let result = resolveAbsolutePathFromResolvedRoots(outsideFile, roots)
      assert.equal(result, null)
    })
  })

  describe('resolvePublicPathFromResolvedRoots', () => {
    it('matches prefixed roots before the fallback root', () => {
      let result = resolvePublicPathFromResolvedRoots('packages/shared/src/index.ts', roots)
      assert.ok(result)
      assert.equal(result.resolvedRoot.prefix, 'packages')
      assert.equal(result.relativePath, 'shared/src/index.ts')
    })

    it('uses the fallback root when no prefix matches', () => {
      let result = resolvePublicPathFromResolvedRoots('app/utils/helper.ts', roots)
      assert.ok(result)
      assert.equal(result.resolvedRoot.prefix, null)
      assert.equal(result.relativePath, 'app/utils/helper.ts')
    })

    it('requires prefix matches to respect segment boundaries', () => {
      let result = resolvePublicPathFromResolvedRoots('packages-ui/button.ts', roots)
      assert.ok(result)
      assert.equal(result.resolvedRoot.prefix, null)
      assert.equal(result.relativePath, 'packages-ui/button.ts')
    })
  })

  describe('absolutePathToPublicPath', () => {
    it('returns the normalized public path for files in a prefixed root', () => {
      let filePath = path.join(packagesRoot, 'shared/src/index.ts')
      assert.equal(absolutePathToPublicPath(filePath, roots), 'packages/shared/src/index.ts')
    })

    it('returns null when the file is outside configured roots', async () => {
      let outsideFile = path.join(tmpDir, 'outside.ts')
      await fs.writeFile(outsideFile, '')
      assert.equal(absolutePathToPublicPath(outsideFile, roots), null)
    })
  })

  describe('symlinks', () => {
    it('resolves symlinked files to their real path for public path computation', async () => {
      let realFile = path.join(appRoot, 'app/utils/helper.ts')
      let linkPath = path.join(appRoot, 'app/utils/helper-link.ts')
      try {
        await fs.symlink(realFile, linkPath)
      } catch {
        return
      }

      assert.equal(absolutePathToPublicPath(linkPath, roots), 'app/utils/helper.ts')

      await fs.rm(linkPath, { force: true })
    })
  })
})
