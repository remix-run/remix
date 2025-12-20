import * as assert from 'node:assert'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { beforeEach, afterEach, describe, it } from 'node:test'

import { openLazyFile, writeFile } from './fs.ts'

describe('openLazyFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-'))
  })

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  function createTestFile(filename: string, content: string = 'test content'): string {
    let filePath = path.join(tmpDir, filename)
    let dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content)
    return filePath
  }

  it('opens a file and reads content', async () => {
    let filePath = createTestFile('test.txt', 'hello world')

    let lazyFile = openLazyFile(filePath)

    assert.equal(lazyFile.name, filePath)
    assert.equal(lazyFile.size, 11)
    assert.equal(await lazyFile.text(), 'hello world')
  })

  it('sets MIME type based on file extension', () => {
    let htmlPath = createTestFile('test.html', '<html></html>')
    let jsonPath = createTestFile('test.json', '{}')
    let txtPath = createTestFile('test.txt', 'text')

    assert.equal(openLazyFile(htmlPath).type, 'text/html')
    assert.equal(openLazyFile(jsonPath).type, 'application/json')
    assert.equal(openLazyFile(txtPath).type, 'text/plain')
  })

  it('sets lastModified from file stats', () => {
    let filePath = createTestFile('test.txt', 'content')
    let stats = fs.statSync(filePath)

    let lazyFile = openLazyFile(filePath)

    assert.equal(lazyFile.lastModified, stats.mtimeMs)
  })

  it('overrides file name with options.name', () => {
    let filePath = createTestFile('test.txt', 'content')

    let lazyFile = openLazyFile(filePath, { name: 'custom.txt' })

    assert.equal(lazyFile.name, 'custom.txt')
  })

  it('overrides MIME type with options.type', () => {
    let filePath = createTestFile('test.txt', 'content')

    let lazyFile = openLazyFile(filePath, { type: 'application/custom' })

    assert.equal(lazyFile.type, 'application/custom')
  })

  it('overrides lastModified with options.lastModified', () => {
    let filePath = createTestFile('test.txt', 'content')
    let customTime = Date.now() - 1000000

    let lazyFile = openLazyFile(filePath, { lastModified: customTime })

    assert.equal(lazyFile.lastModified, customTime)
  })

  it('reads file as ArrayBuffer', async () => {
    let filePath = createTestFile('test.txt', 'hello')

    let lazyFile = openLazyFile(filePath)
    let buffer = await lazyFile.arrayBuffer()

    assert.equal(buffer.byteLength, 5)
    assert.equal(new TextDecoder().decode(buffer), 'hello')
  })

  it('streams file content', async () => {
    let filePath = createTestFile('test.txt', 'streaming content')

    let lazyFile = openLazyFile(filePath)
    let chunks: Uint8Array[] = []

    for await (let chunk of lazyFile.stream()) {
      chunks.push(chunk)
    }

    let combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
    let offset = 0
    for (let chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    assert.equal(new TextDecoder().decode(combined), 'streaming content')
  })

  it('handles empty files', async () => {
    let filePath = createTestFile('empty.txt', '')

    let lazyFile = openLazyFile(filePath)

    assert.equal(lazyFile.size, 0)
    assert.equal(await lazyFile.text(), '')
  })

  it('handles large files', async () => {
    let largeContent = 'x'.repeat(10000)
    let filePath = createTestFile('large.txt', largeContent)

    let lazyFile = openLazyFile(filePath)

    assert.equal(lazyFile.size, 10000)
    assert.equal(await lazyFile.text(), largeContent)
  })

  it('throws error for non-existent files', () => {
    let nonExistentPath = path.join(tmpDir, 'nonexistent.txt')

    assert.throws(
      () => openLazyFile(nonExistentPath),
      (error: Error) => error.message.includes('ENOENT'),
    )
  })

  it('throws error when opening a directory', () => {
    let dirPath = path.join(tmpDir, 'testdir')
    fs.mkdirSync(dirPath)

    assert.throws(
      () => openLazyFile(dirPath),
      (error: Error) => error.message.includes('is not a file'),
    )
  })
})

describe('writeFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-test-'))
  })

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('writes file to a path', async () => {
    let sourcePath = path.join(tmpDir, 'source.txt')
    let destPath = path.join(tmpDir, 'dest.txt')
    fs.writeFileSync(sourcePath, 'test content')

    let lazyFile = openLazyFile(sourcePath)
    await writeFile(destPath, lazyFile)

    assert.equal(fs.readFileSync(destPath, 'utf-8'), 'test content')
  })

  it('writes file using a file descriptor', async () => {
    let sourcePath = path.join(tmpDir, 'source.txt')
    let destPath = path.join(tmpDir, 'dest.txt')
    fs.writeFileSync(sourcePath, 'test content')

    let lazyFile = openLazyFile(sourcePath)
    let fd = fs.openSync(destPath, 'w')

    await writeFile(fd, lazyFile)
    // Note: fd is automatically closed by the write stream

    assert.equal(fs.readFileSync(destPath, 'utf-8'), 'test content')
  })

  it('writes file using a FileHandle', async () => {
    let sourcePath = path.join(tmpDir, 'source.txt')
    let destPath = path.join(tmpDir, 'dest.txt')
    fs.writeFileSync(sourcePath, 'test content')

    let lazyFile = openLazyFile(sourcePath)
    let handle = await fsp.open(destPath, 'w')

    await writeFile(handle, lazyFile)
    await handle.close()

    assert.equal(fs.readFileSync(destPath, 'utf-8'), 'test content')
  })

  it('writes empty files', async () => {
    let sourcePath = path.join(tmpDir, 'empty.txt')
    let destPath = path.join(tmpDir, 'dest.txt')
    fs.writeFileSync(sourcePath, '')

    let lazyFile = openLazyFile(sourcePath)
    await writeFile(destPath, lazyFile)

    assert.equal(fs.readFileSync(destPath, 'utf-8'), '')
  })

  it('writes large files', async () => {
    let largeContent = 'x'.repeat(100000)
    let sourcePath = path.join(tmpDir, 'large.txt')
    let destPath = path.join(tmpDir, 'dest.txt')
    fs.writeFileSync(sourcePath, largeContent)

    let lazyFile = openLazyFile(sourcePath)
    await writeFile(destPath, lazyFile)

    assert.equal(fs.readFileSync(destPath, 'utf-8'), largeContent)
  })

  it('creates parent directories when writing to path', async () => {
    let sourcePath = path.join(tmpDir, 'source.txt')
    let destPath = path.join(tmpDir, 'nested', 'dir', 'dest.txt')
    fs.writeFileSync(sourcePath, 'content')
    fs.mkdirSync(path.dirname(destPath), { recursive: true })

    let lazyFile = openLazyFile(sourcePath)
    await writeFile(destPath, lazyFile)

    assert.ok(fs.existsSync(destPath))
    assert.equal(fs.readFileSync(destPath, 'utf-8'), 'content')
  })

  it('preserves file content exactly', async () => {
    let binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd])
    let sourcePath = path.join(tmpDir, 'binary.dat')
    let destPath = path.join(tmpDir, 'dest.dat')
    fs.writeFileSync(sourcePath, binaryData)

    let lazyFile = openLazyFile(sourcePath)
    await writeFile(destPath, lazyFile)

    let written = fs.readFileSync(destPath)
    assert.deepEqual(written, binaryData)
  })
})
