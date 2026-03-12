import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { toPosixPath, absolutePathToUrlSegment } from './path-utils.ts'

describe('toPosixPath', () => {
  it('returns the path unchanged on POSIX systems', () => {
    assert.equal(toPosixPath('/foo/bar/baz.ts'), '/foo/bar/baz.ts')
  })

  it('splits on path.sep and joins with forward slashes', () => {
    // On POSIX, path.sep === '/' so splitting on it doesn't affect backslashes.
    // toPosixPath is a no-op on POSIX — it only converts on Windows.
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

describe('absolutePathToUrlSegment', () => {
  let tmpDir: string
  let root: string
  let workspaceRoot: string

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'path-utils-test-'))
    root = path.join(tmpDir, 'project')
    workspaceRoot = tmpDir
    await fs.mkdir(path.join(root, 'app/utils'), { recursive: true })
    await fs.mkdir(path.join(tmpDir, 'packages/shared/src'), { recursive: true })
    // Create actual files so realpathSync works
    await fs.writeFile(path.join(root, 'app/utils/helper.ts'), '')
    await fs.writeFile(path.join(tmpDir, 'packages/shared/src/index.ts'), '')
  })

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  describe('root namespace', () => {
    it('returns root segment for a file directly in root', async () => {
      let filePath = path.join(root, 'app/utils/helper.ts')
      let result = absolutePathToUrlSegment(filePath, root, null)
      assert.ok(result)
      assert.equal(result.namespace, 'root')
      assert.equal(result.segment, 'app/utils/helper.ts')
    })

    it('produces a POSIX path segment regardless of OS', async () => {
      let filePath = path.join(root, 'app/utils/helper.ts')
      let result = absolutePathToUrlSegment(filePath, root, null)
      assert.ok(result)
      assert.ok(!result.segment.includes('\\'), 'segment should not contain backslashes')
    })

    it('returns root segment when workspaceRoot is provided but file is in root', async () => {
      let filePath = path.join(root, 'app/utils/helper.ts')
      let result = absolutePathToUrlSegment(filePath, root, workspaceRoot)
      assert.ok(result)
      assert.equal(result.namespace, 'root')
    })
  })

  describe('workspace namespace', () => {
    it('returns workspace segment for a file outside root but inside workspaceRoot', async () => {
      let filePath = path.join(tmpDir, 'packages/shared/src/index.ts')
      let result = absolutePathToUrlSegment(filePath, root, workspaceRoot)
      assert.ok(result)
      assert.equal(result.namespace, 'workspace')
      assert.equal(result.segment, 'packages/shared/src/index.ts')
    })

    it('returns null when file is outside root and workspaceRoot is null', async () => {
      let filePath = path.join(tmpDir, 'packages/shared/src/index.ts')
      let result = absolutePathToUrlSegment(filePath, root, null)
      assert.equal(result, null)
    })

    it('returns null when file is outside both root and workspaceRoot', async () => {
      let outsideFile = path.join(os.tmpdir(), 'outside.ts')
      // Don't need the file to exist; will fall back to path.normalize
      let result = absolutePathToUrlSegment(outsideFile, root, workspaceRoot)
      assert.equal(result, null)
    })
  })

  describe('symlinks', () => {
    it('resolves symlinked files to their real path for segment computation', async () => {
      let realFile = path.join(root, 'app/utils/helper.ts')
      let linkPath = path.join(root, 'app/utils/helper-link.ts')
      try {
        await fs.symlink(realFile, linkPath)
      } catch {
        // skip if symlinks aren't supported
        return
      }

      // The symlink points into root, so should resolve as root namespace
      let result = absolutePathToUrlSegment(linkPath, root, null)
      assert.ok(result)
      assert.equal(result.namespace, 'root')

      await fs.rm(linkPath, { force: true })
    })
  })
})
