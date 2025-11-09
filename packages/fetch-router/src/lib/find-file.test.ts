import * as assert from 'node:assert/strict'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, beforeEach, afterEach } from 'node:test'

import { findFile } from './find-file.ts'

describe('findFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'find-file-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  function createTestFile(filename: string, content: string) {
    let filePath = path.join(tmpDir, filename)
    let dir = path.dirname(filePath)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(filePath, content)

    return filePath
  }

  describe('basic functionality', () => {
    it('finds a file from the filesystem', async () => {
      createTestFile('test.txt', 'Hello, World!')

      let file = await findFile(tmpDir, 'test.txt')

      assert.ok(file)
      assert.ok(file instanceof File)
      assert.equal(file.name, path.join(path.resolve(tmpDir), 'test.txt'))
      assert.equal(await file.text(), 'Hello, World!')
      assert.equal(file.type, 'text/plain')
    })

    it('finds files from nested directories', async () => {
      createTestFile('dir/subdir/file.txt', 'Nested file')

      let file = await findFile(tmpDir, 'dir/subdir/file.txt')

      assert.ok(file)
      assert.ok(file instanceof File)
      assert.equal(file.name, path.join(path.resolve(tmpDir), 'dir/subdir/file.txt'))
      assert.equal(await file.text(), 'Nested file')
    })

    it('returns null for non-existent file', async () => {
      let file = await findFile(tmpDir, 'nonexistent.txt')

      assert.equal(file, null)
    })

    it('returns null when directory is requested', async () => {
      let dirPath = path.join(tmpDir, 'subdir')
      fs.mkdirSync(dirPath)

      let file = await findFile(tmpDir, 'subdir')

      assert.equal(file, null)
    })
  })

  describe('path resolution', () => {
    it('resolves relative root paths', async () => {
      let relativeTmpDir = path.relative(process.cwd(), tmpDir)
      createTestFile('test.txt', 'Hello')

      let file = await findFile(relativeTmpDir, 'test.txt')

      assert.ok(file)
      assert.ok(file instanceof File)
      assert.equal(file.name, path.join(path.resolve(relativeTmpDir), 'test.txt'))
      assert.equal(await file.text(), 'Hello')
    })

    it('resolves absolute root paths', async () => {
      let absoluteTmpDir = path.resolve(tmpDir)
      createTestFile('test.txt', 'Hello')

      let file = await findFile(absoluteTmpDir, 'test.txt')

      assert.ok(file)
      assert.ok(file instanceof File)
      assert.equal(file.name, path.join(absoluteTmpDir, 'test.txt'))
      assert.equal(await file.text(), 'Hello')
    })
  })

  describe('security', () => {
    it('prevents path traversal with .. in pathname', async () => {
      createTestFile('secret.txt', 'Secret content')

      let publicDirName = 'public'
      createTestFile(`${publicDirName}/allowed.txt`, 'Allowed content')

      let publicDir = path.join(tmpDir, publicDirName)

      let file = await findFile(publicDir, 'allowed.txt')
      assert.ok(file)
      assert.ok(file instanceof File)
      assert.equal(file.name, path.join(path.resolve(publicDir), 'allowed.txt'))
      assert.equal(await file.text(), 'Allowed content')

      let traversalFile = await findFile(publicDir, '../secret.txt')
      assert.equal(traversalFile, null)
    })

    it('does not support absolute paths as the second argument', async () => {
      let parentDir = path.dirname(tmpDir)
      let secretFileName = 'secret-outside-root.txt'
      let secretPath = path.join(parentDir, secretFileName)
      fs.writeFileSync(secretPath, 'Secret content')

      try {
        let result = await findFile(tmpDir, secretPath)
        assert.equal(result, null)
      } finally {
        fs.unlinkSync(secretPath)
      }
    })
  })

  describe('error handling', () => {
    it('throws non-ENOENT errors', async () => {
      // Return a path with invalid characters that will cause an error other than ENOENT
      await assert.rejects(
        async () => {
          await findFile(tmpDir, '\x00invalid')
        },
        (error: any) => {
          return error.code !== 'ENOENT'
        },
      )
    })
  })
})
