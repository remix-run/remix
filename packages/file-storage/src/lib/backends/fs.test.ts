import * as assert from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { parseFormData } from '@remix-run/form-data-parser'
import { LazyFile } from '@remix-run/lazy-file'

import type { FileLike, FileStorage } from '../file-storage.ts'
import { createFsFileStorage } from './fs.ts'

// Compile-time API contract checks. These expressions are never executed, but TypeScript will
// fail this file if FileLike stops accepting native File/LazyFile values, or if the filesystem
// backend stops advertising LazyFile return values through FileStorage.
null as unknown as File satisfies FileLike
null as unknown as LazyFile satisfies FileLike
null as unknown as ReturnType<typeof createFsFileStorage> satisfies FileStorage<LazyFile>

function normalizeFileType(type: string): string {
  return new File([''], '', { type }).type
}

async function writeLegacyFile(directory: string, key: string, file: File) {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  let hash = Buffer.from(digest).toString('hex')
  let subdir = path.join(directory, hash.slice(0, 2))
  fs.mkdirSync(subdir, { recursive: true })
  let dataPath = path.join(subdir, `${hash}.dat`)
  let metaPath = path.join(subdir, `${hash}.meta.json`)
  fs.writeFileSync(dataPath, new Uint8Array(await file.arrayBuffer()))
  fs.writeFileSync(
    metaPath,
    JSON.stringify({
      key,
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    }),
  )
  return { dataPath, metaPath }
}

describe('fs file storage', () => {
  let tmpDir: string
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-file-storage-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('stores and retrieves files', async () => {
    let storage = createFsFileStorage(tmpDir)
    let lastModified = Date.now()
    let file = new File(['Hello, world!'], 'hello.txt', {
      type: 'text/plain',
      lastModified,
    })

    await storage.set('hello', file)

    assert.ok(await storage.has('hello'))

    let retrieved = await storage.get('hello')

    assert.ok(retrieved)
    assert.equal(retrieved instanceof LazyFile, true)
    assert.equal(retrieved.name, 'hello.txt')
    assert.equal(retrieved.type, file.type)
    assert.equal(retrieved.lastModified, lastModified)
    assert.equal(retrieved.size, 13)

    let text = await retrieved.text()

    assert.equal(text, 'Hello, world!')

    await storage.remove('hello')

    assert.ok(!(await storage.has('hello')))
    assert.equal(await storage.get('hello'), null)
  })

  it('stores file size in metadata', async () => {
    let storage = createFsFileStorage(tmpDir)
    let file = new File(['Hello, world!'], 'hello.txt', { type: 'text/plain' })

    await storage.set('hello', file)

    let reopened = createFsFileStorage(tmpDir)
    let { files } = await reopened.list({ includeMetadata: true })
    assert.deepEqual(files, [
      {
        key: 'hello',
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
      },
    ])
  })

  it('removes empty hash directories after removing files', async () => {
    let storage = createFsFileStorage(tmpDir)
    let file = new File(['Test content'], 'test.txt', { type: 'text/plain' })

    // Set a file
    await storage.set('test-key', file)

    // Verify subdirectories exist
    let subdirs = fs
      .readdirSync(tmpDir)
      .filter((name) => fs.statSync(path.join(tmpDir, name)).isDirectory())
    assert.ok(subdirs.length > 0)

    // Remove the file
    await storage.remove('test-key')

    // Verify no subdirectories remain
    let subdirsAfter = fs
      .readdirSync(tmpDir)
      .filter((name) => fs.statSync(path.join(tmpDir, name)).isDirectory())
    assert.equal(subdirsAfter.length, 0)
  })

  it('lists files with pagination', async () => {
    let storage = createFsFileStorage(tmpDir)
    let allKeys = ['a', 'b', 'c', 'd', 'e']

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    )

    let { cursor, files } = await storage.list()
    assert.equal(cursor, undefined)
    assert.equal(files.length, 5)
    assert.deepEqual(files.map((f) => f.key).sort(), allKeys)

    let { cursor: cursor1, files: files1 } = await storage.list({ limit: 0 })
    assert.equal(cursor1, undefined)
    assert.equal(files1.length, 0)

    let { cursor: cursor2, files: files2 } = await storage.list({ limit: 2 })
    assert.notEqual(cursor2, undefined)
    assert.equal(files2.length, 2)

    let { cursor: cursor3, files: files3 } = await storage.list({ cursor: cursor2 })
    assert.equal(cursor3, undefined)
    assert.equal(files3.length, 3)

    assert.deepEqual([...files2, ...files3].map((f) => f.key).sort(), allKeys)
  })

  it('lists files by key prefix', async () => {
    let storage = createFsFileStorage(tmpDir)
    let allKeys = ['a', 'b', 'b/c', 'c', 'd']

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    )

    let { cursor, files } = await storage.list({ prefix: 'b' })
    assert.equal(cursor, undefined)
    assert.equal(files.length, 2)
    assert.deepEqual(files.map((f) => f.key).sort(), ['b', 'b/c'])
  })

  it('lists files with metadata', async () => {
    let storage = createFsFileStorage(tmpDir)
    let allKeys = ['a', 'b', 'c', 'd', 'e']

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    )

    let { cursor, files } = await storage.list({ includeMetadata: true })
    assert.equal(cursor, undefined)
    assert.equal(files.length, 5)
    assert.deepEqual(files.map((f) => f.key).sort(), allKeys)
    files.forEach((f) => assert.ok('lastModified' in f))
    files.forEach((f) => assert.ok('name' in f))
    files.forEach((f) => assert.ok('size' in f))
    files.forEach((f) => assert.ok('type' in f))
  })

  it('stores different keys concurrently', async () => {
    let storage = createFsFileStorage(tmpDir)
    let lastModified = Date.now()

    let file1 = new File(['Hello, world!'], 'hello1.txt', {
      type: 'text/plain',
      lastModified,
    })

    let file2 = new File(['Hello, universe!'], 'hello2.txt', {
      type: 'text/plain',
      lastModified,
    })

    let setOnePromise = storage.set('one', file1)
    let setTwoPromise = storage.set('two', file2)
    await Promise.all([setOnePromise, setTwoPromise])

    let retrieved1 = await storage.get('one')
    assert.ok(retrieved1)
    assert.equal(await retrieved1.text(), 'Hello, world!')

    let retrieved2 = await storage.get('two')
    assert.ok(retrieved2)
    assert.equal(await retrieved2.text(), 'Hello, universe!')
  })

  it('preserves the stored file when an upload fails', async () => {
    let storage = createFsFileStorage(tmpDir)
    let original = new File(['original content'], 'original.txt', { type: 'text/plain' })
    await storage.set('file', original)
    let entries = fs.readdirSync(tmpDir, { recursive: true, encoding: 'utf-8' })
    let failure = new Error('Upload interrupted')
    let upload = new LazyFile(
      {
        byteLength: 100_000,
        stream() {
          let sent = false
          return new ReadableStream({
            pull(controller) {
              if (sent) throw failure
              sent = true
              controller.enqueue(new Uint8Array(64 * 1024).fill(65))
            },
          })
        },
      },
      'replacement.txt',
    )

    await assert.rejects(async () => storage.set('file', upload), failure)

    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'original content')
    assert.equal(stored.name, original.name)
    assert.equal(stored.type, original.type)
    assert.equal(stored.size, original.size)
    assert.deepEqual(fs.readdirSync(tmpDir, { recursive: true }), entries)
  })

  it('cleans up an unpublished upload when its stream fails', async () => {
    let storage = createFsFileStorage(tmpDir)
    let failure = new Error('Upload interrupted')
    let upload = new LazyFile(
      {
        byteLength: 1,
        stream() {
          return new ReadableStream({
            start(controller) {
              controller.error(failure)
            },
          })
        },
      },
      'file.txt',
    )

    await assert.rejects(async () => storage.set('file', upload), failure)
    assert.equal(await storage.get('file'), null)
    assert.equal(await storage.has('file'), false)
    assert.deepEqual((await storage.list()).files, [])
    let files = fs.readdirSync(tmpDir, { recursive: true, withFileTypes: true })
    assert.equal(files.filter((file) => file.isFile()).length, 0)
  })

  it('preserves the stored file when reading upload metadata fails', async () => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let upload = new File(['replacement'], 'replacement.txt')
    let failure = new Error('Metadata unavailable')
    Object.defineProperty(upload, 'name', {
      get() {
        throw failure
      },
    })

    await assert.rejects(async () => storage.set('file', upload), failure)
    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'original')
  })

  it('preserves the stored file when temporary metadata cannot be created', async () => {
    let { dataPath, metaPath } = await writeLegacyFile(
      tmpDir,
      'file',
      new File(['original'], 'original.txt'),
    )
    let storage = createFsFileStorage(tmpDir)
    let entries = fs.readdirSync(tmpDir, { recursive: true, encoding: 'utf-8' })
    let blocker: string | undefined
    let upload = new File(['replacement'], 'replacement.txt')
    Object.defineProperty(upload, 'name', {
      get() {
        let newData = fs
          .readdirSync(path.dirname(dataPath))
          .find((name) => name.endsWith('.dat') && name !== path.basename(dataPath))
        assert.ok(newData)
        let version = newData.split('.')[1]
        blocker = `${metaPath}.${version}.tmp`
        fs.mkdirSync(blocker)
        return 'replacement.txt'
      },
    })

    try {
      await assert.rejects(async () => storage.set('file', upload))
      assert.ok(blocker)
      assert.equal(fs.statSync(blocker).isDirectory(), true)
    } finally {
      if (blocker !== undefined) fs.rmdirSync(blocker)
    }
    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'original')
    assert.deepEqual(fs.readdirSync(tmpDir, { recursive: true, encoding: 'utf-8' }), entries)
  })

  it('preserves the stored file and cleans up when publication fails', async () => {
    let { metaPath } = await writeLegacyFile(tmpDir, 'file', new File(['original'], 'original.txt'))
    let storage = createFsFileStorage(tmpDir)
    let entries = fs.readdirSync(tmpDir, { recursive: true, encoding: 'utf-8' })
    let backup = `${metaPath}.backup`
    let upload = new File(['replacement'], 'replacement.txt')
    Object.defineProperty(upload, 'name', {
      get() {
        // Obstruct the commit after the existing metadata has been read.
        fs.renameSync(metaPath, backup)
        fs.mkdirSync(metaPath)
        return 'replacement.txt'
      },
    })

    try {
      await assert.rejects(async () => storage.set('file', upload))
    } finally {
      fs.rmdirSync(metaPath)
      fs.renameSync(backup, metaPath)
    }
    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'original')
    assert.equal(stored.name, 'original.txt')
    assert.deepEqual(fs.readdirSync(tmpDir, { recursive: true }), entries)
  })

  it('succeeds after publication even if old content cannot be removed', async () => {
    let { dataPath } = await writeLegacyFile(tmpDir, 'file', new File(['original'], 'original.txt'))
    let storage = createFsFileStorage(tmpDir)
    let upload = new File(['replacement'], 'replacement.txt')
    Object.defineProperty(upload, 'name', {
      get() {
        // A directory at the old content path makes non-recursive removal fail.
        fs.renameSync(dataPath, `${dataPath}.backup`)
        fs.mkdirSync(dataPath)
        return 'replacement.txt'
      },
    })

    let stored = await storage.put('file', upload)
    assert.equal(await stored.text(), 'replacement')
    assert.equal(stored.name, 'replacement.txt')
    assert.equal(fs.statSync(dataPath).isDirectory(), true)
    let reopened = await createFsFileStorage(tmpDir).get('file')
    assert.ok(reopened)
    assert.equal(await reopened.text(), 'replacement')
  })

  it('replaces versioned content and removes the previous data file', async () => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let entries = fs.readdirSync(tmpDir, { recursive: true, encoding: 'utf-8' })
    let oldData = entries.find((name) => name.endsWith('.dat'))
    let metadata = entries.find((name) => name.endsWith('.meta.json'))
    assert.ok(oldData)
    assert.ok(metadata)

    let stored = await storage.put('file', new File(['replacement'], 'replacement.txt'))
    assert.equal(await stored.text(), 'replacement')
    assert.equal(fs.existsSync(path.join(tmpDir, oldData)), false)
    let files = fs.readdirSync(tmpDir, { recursive: true, withFileTypes: true })
    assert.equal(files.filter((file) => file.isFile()).length, 2)
    let record: unknown = JSON.parse(fs.readFileSync(path.join(tmpDir, metadata), 'utf-8'))
    assert.ok(
      record !== null &&
        typeof record === 'object' &&
        'dataFile' in record &&
        typeof record.dataFile === 'string',
    )
    assert.equal(
      fs.readFileSync(path.join(tmpDir, path.dirname(metadata), record.dataFile), 'utf-8'),
      'replacement',
    )

    await storage.remove('file')
    await storage.remove('file')
    assert.deepEqual(fs.readdirSync(tmpDir), [])
  })

  it('reads empty files, binary content, and slices', async () => {
    let storage = createFsFileStorage(tmpDir)
    let empty = await storage.put('empty', new LazyFile([], 'empty.txt'))
    assert.equal(empty.size, 0)
    assert.equal(await empty.text(), '')
    let content = new Uint8Array([0, 255, 123, 34, 10, 128])
    let stored = await storage.put('binary', new File([content], 'résumé.bin'))
    assert.equal(stored.name, 'résumé.bin')
    assert.equal(stored.size, content.length)
    assert.deepEqual(await stored.bytes(), content)
    assert.deepEqual(await stored.slice(1, 4).bytes(), content.slice(1, 4))
    assert.deepEqual(await stored.slice(-2).bytes(), content.slice(-2))
  })

  it('reads and replaces legacy entries without listing duplicates or leaving old files', async () => {
    let original = new File(['legacy content'], 'legacy.txt', {
      type: 'text/plain',
      lastModified: 123,
    })
    let { dataPath, metaPath } = await writeLegacyFile(tmpDir, 'legacy', original)
    let storage = createFsFileStorage(tmpDir)
    let stored = await storage.get('legacy')
    assert.ok(stored)
    assert.equal(await stored.text(), 'legacy content')
    assert.equal(stored.name, original.name)
    assert.equal(stored.type, original.type)
    assert.equal(stored.lastModified, original.lastModified)
    assert.equal(await storage.has('legacy'), true)
    assert.deepEqual((await storage.list()).files, [{ key: 'legacy' }])

    await storage.set('legacy', new File(['replacement'], 'new.txt'))
    assert.equal(fs.existsSync(dataPath), false)
    assert.equal(fs.existsSync(metaPath), true)
    let reopened = createFsFileStorage(tmpDir)
    stored = await reopened.get('legacy')
    assert.ok(stored)
    assert.equal(await stored.text(), 'replacement')
    assert.equal(stored.name, 'new.txt')

    assert.deepEqual((await reopened.list()).files, [{ key: 'legacy' }])
    let { files } = await reopened.list({ includeMetadata: true })
    assert.equal(files.length, 1)
    assert.equal(files[0].name, 'new.txt')
    await reopened.remove('legacy')
    assert.equal(await reopened.get('legacy'), null)
    assert.deepEqual(fs.readdirSync(tmpDir), [])
  })

  it('ignores unpublished metadata and unreferenced content left by an interrupted process', async () => {
    let { dataPath, metaPath } = await writeLegacyFile(
      tmpDir,
      'file',
      new File(['original'], 'original.txt'),
    )
    let storage = createFsFileStorage(tmpDir)
    let abandonedData = dataPath.replace(/\.dat$/, `.${crypto.randomUUID()}.dat`)
    let abandonedMetadata = `${metaPath}.${crypto.randomUUID()}.tmp`
    fs.writeFileSync(abandonedData, 'incomplete upload')
    fs.writeFileSync(abandonedMetadata, '{')

    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'original')
    assert.deepEqual((await storage.list()).files, [{ key: 'file' }])
    await storage.remove('file')
    assert.equal(await storage.has('file'), false)
    assert.deepEqual((await storage.list()).files, [])
    assert.equal(fs.existsSync(abandonedData), true)
    assert.equal(fs.existsSync(abandonedMetadata), true)
  })

  it('rejects metadata that points outside its entry', async () => {
    let { dataPath, metaPath } = await writeLegacyFile(
      tmpDir,
      'file',
      new File(['original'], 'original.txt'),
    )
    let record: unknown = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    assert.ok(record !== null && typeof record === 'object')
    fs.writeFileSync(metaPath, JSON.stringify({ ...record, dataFile: '../unrelated.dat' }))
    let unrelatedPath = path.join(tmpDir, 'unrelated.dat')
    fs.writeFileSync(unrelatedPath, 'unrelated')
    let storage = createFsFileStorage(tmpDir)

    await assert.rejects(async () => storage.get('file'), /Invalid stored file content path/)
    await assert.rejects(async () => storage.remove('file'), /Invalid stored file content path/)
    await assert.rejects(
      async () => storage.set('file', new File(['new'], 'new.txt')),
      /Invalid stored file content path/,
    )
    assert.equal(fs.readFileSync(unrelatedPath, 'utf-8'), 'unrelated')
    assert.equal(fs.readFileSync(dataPath, 'utf-8'), 'original')
  })

  it('reads and replaces legacy entries that do not store their size', async () => {
    let { metaPath } = await writeLegacyFile(tmpDir, 'legacy', new File(['legacy'], 'legacy.txt'))
    let record: unknown = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    assert.ok(record !== null && typeof record === 'object')
    Reflect.deleteProperty(record, 'size')
    fs.writeFileSync(metaPath, JSON.stringify(record))
    let storage = createFsFileStorage(tmpDir)

    let stored = await storage.get('legacy')
    assert.ok(stored)
    assert.equal(stored.size, 6)
    assert.equal(await stored.text(), 'legacy')
    assert.equal((await storage.list({ includeMetadata: true })).files[0].size, 6)
    stored = await storage.put('legacy', new File(['replacement'], 'new.txt'))
    assert.equal(await stored.text(), 'replacement')
  })

  it('removes a legacy entry without requiring it to be rewritten', async () => {
    await writeLegacyFile(tmpDir, 'legacy', new File(['legacy'], 'legacy.txt'))
    let storage = createFsFileStorage(tmpDir)
    await storage.remove('legacy')
    assert.equal(await storage.has('legacy'), false)
    assert.deepEqual(fs.readdirSync(tmpDir), [])
  })

  it('throws if directory is a file', () => {
    fs.mkdirSync(tmpDir, { recursive: true })
    let filePath = path.join(tmpDir, 'not-a-directory')
    fs.writeFileSync(filePath, 'I am a file')

    assert.throws(
      () => {
        createFsFileStorage(filePath)
      },
      new Error(`Path "${filePath}" is not a directory`),
    )
  })

  it('puts files', async () => {
    let storage = createFsFileStorage(tmpDir)
    let lastModified = Date.now()
    let file = new File(['Hello, world!'], 'hello.txt', {
      type: 'text/plain',
      lastModified,
    })

    let retrieved = await storage.put('hello', file)

    assert.ok(await storage.has('hello'))
    assert.ok(retrieved)
    assert.equal(retrieved.name, 'hello.txt')
    assert.equal(retrieved.type, file.type)
    assert.equal(retrieved.lastModified, lastModified)
    assert.equal(retrieved.size, 13)
  })

  describe('integration with form-data-parser', () => {
    it('stores and lists file uploads', async () => {
      let storage = createFsFileStorage(tmpDir)

      let boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
      let fileType = normalizeFileType('text/plain')
      let request = new Request('http://example.com', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="hello"; filename="hello.txt"',
          `Content-Type: ${fileType}`,
          '',
          'Hello, world!',
          `--${boundary}--`,
        ].join('\r\n'),
      })

      await parseFormData(request, async (file) => {
        await storage.set('hello', file)
      })

      assert.ok(await storage.has('hello'))

      let { files } = await storage.list({ includeMetadata: true })

      assert.equal(files.length, 1)
      assert.equal(files[0].key, 'hello')
      assert.equal(files[0].name, 'hello.txt')
      assert.equal(files[0].size, 13)
      assert.equal(files[0].type, fileType)
      assert.ok(files[0].lastModified)
    })
  })
})
