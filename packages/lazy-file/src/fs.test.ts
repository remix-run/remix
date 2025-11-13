import * as assert from 'node:assert'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it } from 'node:test'

import { findFile, openFile } from './fs.ts'

describe('openFile', () => {
  let tmpDir: string

  function setup() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazy-file-test-'))
  }

  function teardown() {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }

  function createTestFile(filename: string, content: string = 'test content'): string {
    let filePath = path.join(tmpDir, filename)
    let dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content)
    return filePath
  }

  it('returns a file', async () => {
    setup()
    let filePath = createTestFile('test.txt', 'hello world')

    let result = openFile(filePath)

    assert.equal(result.name, filePath)
    assert.equal(result.size, 11)
    assert.equal(await result.text(), 'hello world')

    teardown()
  })
})

describe('findFile', () => {
  let tmpDir: string

  function setup() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazy-file-test-'))
  }

  function teardown() {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  }

  function createTestFile(filename: string, content: string = 'test content'): void {
    let filePath = path.join(tmpDir, filename)
    let dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content)
  }

  it('finds a file in the root directory', async () => {
    setup()
    createTestFile('test.txt', 'hello world')

    let result = await findFile(tmpDir, 'test.txt')

    assert.ok(result)
    assert.equal(result.name, 'test.txt')
    assert.equal(result.size, 11)
    assert.equal(await result.text(), 'hello world')

    teardown()
  })

  it('finds a file in a nested directory', async () => {
    setup()
    createTestFile('assets/styles.css', 'body { color: red; }')

    let result = await findFile(tmpDir, 'assets/styles.css')

    assert.ok(result)
    assert.equal(result.name, 'assets/styles.css')

    teardown()
  })

  it('returns null for non-existent file', async () => {
    setup()

    let result = await findFile(tmpDir, 'nonexistent.txt')

    assert.equal(result, null)

    teardown()
  })

  it('returns null when requesting a directory', async () => {
    setup()
    createTestFile('assets/test.txt', 'content')

    let result = await findFile(tmpDir, 'assets')

    assert.equal(result, null)

    teardown()
  })

  it('prevents path traversal with .. in pathname', async () => {
    setup()
    createTestFile('secret.txt', 'Secret content')

    let publicDir = path.join(tmpDir, 'public')
    fs.mkdirSync(publicDir, { recursive: true })
    createTestFile('public/allowed.txt', 'Allowed content')

    // Try to access file outside of public directory
    let result = await findFile(publicDir, '../secret.txt')

    assert.equal(result, null)

    teardown()
  })

  it('prevents path traversal with absolute path', async () => {
    setup()
    createTestFile('secret.txt', 'Secret content')

    let publicDir = path.join(tmpDir, 'public')
    fs.mkdirSync(publicDir, { recursive: true })
    createTestFile('public/allowed.txt', 'Allowed content')

    // Try to access file with absolute path
    let secretPath = path.join(tmpDir, 'secret.txt')
    let result = await findFile(publicDir, secretPath)

    assert.equal(result, null)

    teardown()
  })

  it('handles relative root paths', async () => {
    setup()
    createTestFile('test.txt', 'hello')

    let cwd = process.cwd()
    try {
      process.chdir(tmpDir)
      let result = await findFile('.', 'test.txt')

      assert.ok(result)
      assert.equal(result.name, 'test.txt')
    } finally {
      process.chdir(cwd)
    }

    teardown()
  })

  it('handles absolute root paths', async () => {
    setup()
    createTestFile('test.txt', 'hello')

    let absoluteTmpDir = path.resolve(tmpDir)
    let result = await findFile(absoluteTmpDir, 'test.txt')

    assert.ok(result)
    assert.equal(result.name, 'test.txt')
    assert.equal(await result.text(), 'hello')

    teardown()
  })

  it('sets file.name to the relative path argument', async () => {
    setup()
    createTestFile('nested/deep/file.txt', 'content')

    let result = await findFile(tmpDir, 'nested/deep/file.txt')

    assert.ok(result)
    assert.equal(result.name, 'nested/deep/file.txt')

    teardown()
  })

  it('throws non-ENOENT errors', async () => {
    setup()

    // Use invalid characters that will cause an error other than ENOENT
    await assert.rejects(
      async () => {
        await findFile(tmpDir, '\x00invalid')
      },
      (error: any) => {
        return error.code !== 'ENOENT'
      },
    )

    teardown()
  })
})
