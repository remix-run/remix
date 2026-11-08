import * as assert from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
import * as fs from 'node:fs'
import fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { parseFormData } from '@remix-run/form-data-parser'
import { parseFormData as parseFutureFormData } from '@remix-run/form-data-parser/future'
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

function findMetadataPath(directory: string): string {
  for (let subdir of fs.readdirSync(directory)) {
    let subdirPath = path.join(directory, subdir)
    if (!fs.statSync(subdirPath).isDirectory()) continue

    for (let entry of fs.readdirSync(subdirPath)) {
      if (entry.endsWith('.meta.json')) {
        return path.join(subdirPath, entry)
      }
    }
  }

  assert.fail('Expected metadata file')
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

    let metadata: unknown = JSON.parse(fs.readFileSync(findMetadataPath(tmpDir), 'utf-8'))

    assert.ok(metadata != null && typeof metadata === 'object')
    assert.ok('size' in metadata)
    assert.equal(metadata.size, file.size)
  })

  it('preserves the previous entry when an upload stream fails', async () => {
    let storage = createFsFileStorage(tmpDir)
    let original = new File(['original content'], 'original.txt', {
      type: 'text/plain',
      lastModified: 123,
    })
    await storage.set('file', original)
    let entries = fs.readdirSync(tmpDir, { recursive: true })
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
    assert.equal(stored.lastModified, original.lastModified)
    assert.deepEqual(fs.readdirSync(tmpDir, { recursive: true }), entries)
  })

  it('preserves the previous entry when metadata staging fails', async (t) => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let entries = fs.readdirSync(tmpDir, { recursive: true })
    let failure = new Error('Cannot create temporary metadata')
    let originalOpen = fsp.open
    let opens = 0
    t.mock.method(fsp, 'open', async (...args: Parameters<typeof fsp.open>) => {
      if (++opens === 2) throw failure
      return originalOpen(...args)
    })

    await assert.rejects(
      async () => storage.set('file', new File(['replacement'], 'new.txt')),
      failure,
    )

    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'original')
    assert.equal(stored.name, 'original.txt')
    assert.deepEqual(fs.readdirSync(tmpDir, { recursive: true }), entries)
  })

  it('retains new content with old metadata after a failed publication and repairs it on retry', async (t) => {
    let storage = createFsFileStorage(tmpDir)
    let original = new File(['old'], 'old.txt', { type: 'text/plain', lastModified: 123 })
    await storage.set('file', original)
    let metaPath = findMetadataPath(tmpDir)
    let failure = new Error('Metadata replacement failed')
    let originalRename = fsp.rename
    let rename = t.mock.method(fsp, 'rename', async (...args: Parameters<typeof fsp.rename>) => {
      if (args[1] === metaPath) throw failure
      return originalRename(...args)
    })
    let replacement = new File(['replacement content'], 'new.json', {
      type: 'application/json',
      lastModified: 456,
    })

    await assert.rejects(async () => storage.set('file', replacement), failure)

    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'replacement content')
    assert.equal(stored.size, replacement.size)
    assert.equal(stored.name, original.name)
    assert.equal(stored.type, original.type)
    assert.equal(stored.lastModified, original.lastModified)
    assert.equal((await storage.list({ includeMetadata: true })).files[0].size, original.size)

    rename.mock.restore?.()
    let repaired = await storage.put('file', replacement)
    assert.equal(await repaired.text(), 'replacement content')
    assert.equal(repaired.name, replacement.name)
    assert.equal(repaired.type, replacement.type)
    assert.equal(repaired.lastModified, replacement.lastModified)
    assert.equal((await storage.list({ includeMetadata: true })).files[0].size, replacement.size)
  })

  it('keeps a new key unpublished when the metadata rename fails', async (t) => {
    let storage = createFsFileStorage(tmpDir)
    let failure = new Error('Metadata replacement failed')
    let originalRename = fsp.rename
    t.mock.method(fsp, 'rename', async (...args: Parameters<typeof fsp.rename>) => {
      if (String(args[1]).endsWith('.meta.json')) throw failure
      return originalRename(...args)
    })

    await assert.rejects(
      async () => storage.set('file', new File(['new content'], 'new.txt')),
      failure,
    )

    assert.equal(await storage.get('file'), null)
    assert.equal(await storage.has('file'), false)
    assert.deepEqual((await storage.list()).files, [])
  })

  it('preserves separate content and metadata modes when replacing files', async () => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let metaPath = findMetadataPath(tmpDir)
    let dataPath = metaPath.replace(/\.meta\.json$/, '.dat')
    fs.chmodSync(dataPath, 0o640)
    fs.chmodSync(metaPath, 0o600)
    let dataMode = fs.statSync(dataPath).mode & 0o777
    let metaMode = fs.statSync(metaPath).mode & 0o777
    let previousUmask = process.umask(0o077)
    try {
      await storage.set('file', new File(['replacement'], 'new.txt'))
    } finally {
      process.umask(previousUmask)
    }

    assert.equal(fs.statSync(dataPath).mode & 0o777, dataMode)
    assert.equal(fs.statSync(metaPath).mode & 0o777, metaMode)
  })

  it('keeps the storage format readable and writable by older versions', async () => {
    let hash = Buffer.from(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode('file')),
    ).toString('hex')
    let directory = path.join(tmpDir, hash.slice(0, 2))
    let dataPath = path.join(directory, `${hash}.dat`)
    let metaPath = path.join(directory, `${hash}.meta.json`)
    fs.mkdirSync(directory)
    let originalMetadata = {
      key: 'file',
      name: 'old.txt',
      type: 'text/plain',
      size: 3,
      lastModified: 123,
    }
    fs.writeFileSync(dataPath, 'old')
    fs.writeFileSync(metaPath, JSON.stringify(originalMetadata))
    let storage = createFsFileStorage(tmpDir)
    let original = await storage.get('file')
    assert.ok(original)
    assert.equal(await original.text(), 'old')

    await storage.put(
      'file',
      new File(['replacement'], 'new.txt', { type: 'text/plain', lastModified: 456 }),
    )

    assert.equal(fs.readFileSync(dataPath, 'utf-8'), 'replacement')
    assert.deepEqual(JSON.parse(fs.readFileSync(metaPath, 'utf-8')), {
      key: 'file',
      name: 'new.txt',
      type: normalizeFileType('text/plain'),
      size: 11,
      lastModified: 456,
    })
    assert.deepEqual(fs.readdirSync(directory).sort(), [`${hash}.dat`, `${hash}.meta.json`])
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

  it('handles race conditions', async () => {
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
    assert.ok(retrieved instanceof LazyFile)
    assert.equal(retrieved.name, 'hello.txt')
    assert.equal(retrieved.type, file.type)
    assert.equal(retrieved.lastModified, lastModified)
    assert.equal(retrieved.size, 13)
    assert.equal(await retrieved.text(), 'Hello, world!')
  })

  describe('integration with form-data-parser', () => {
    it('stores streaming uploads from the future parser', async () => {
      let storage = createFsFileStorage(tmpDir)
      let body = new FormData()
      body.set('avatar', new File(['new avatar'], 'avatar.txt', { type: 'text/plain' }))
      let request = new Request('http://example.com', { method: 'POST', body })

      let formData = await parseFutureFormData(request, async (file) => {
        assert.throws(() => file.size, /not known until its contents have been read/)
        await storage.set('avatar', file)
        return 'avatar'
      })

      assert.equal(formData.get('avatar'), 'avatar')
      let stored = await storage.get('avatar')
      assert.ok(stored)
      assert.equal(await stored.text(), 'new avatar')
      assert.equal(stored.name, 'avatar.txt')
      assert.equal(stored.type, normalizeFileType('text/plain'))
      assert.equal(stored.size, 10)
      assert.equal((await storage.list({ includeMetadata: true })).files[0].size, 10)
    })

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
