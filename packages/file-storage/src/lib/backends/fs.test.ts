import * as assert from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
import * as fs from 'node:fs'
import fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { parseFormData } from '@remix-run/form-data-parser'
import {
  MaxFileSizeExceededError,
  parseFormData as parseFutureFormData,
} from '@remix-run/form-data-parser/future'
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

  it('preserves the previous entry when upload metadata throws', async () => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let entries = fs.readdirSync(tmpDir, { recursive: true })
    let failure = new Error('Metadata unavailable')
    let upload = new File(['replacement'], 'replacement.txt')
    Object.defineProperty(upload, 'name', {
      get() {
        throw failure
      },
    })

    await assert.rejects(async () => storage.put('file', upload), failure)

    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'original')
    assert.equal(stored.name, 'original.txt')
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

  it('preserves the previous entry when the data rename fails', async (t) => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let entries = fs.readdirSync(tmpDir, { recursive: true })
    let metaPath = findMetadataPath(tmpDir)
    let failure = new Error('Content replacement failed')
    let rename = t.mock.method(
      fsp,
      'rename',
      async (source: fs.PathLike, destination: fs.PathLike) => {
        assert.equal(destination, metaPath.replace(/\.meta\.json$/, '.dat'))
        assert.equal(await fsp.readFile(source, 'utf-8'), 'replacement')
        throw failure
      },
    )

    await assert.rejects(
      async () => storage.put('file', new File(['replacement'], 'new.txt')),
      failure,
    )

    assert.equal(rename.mock.calls.length, 1)
    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'original')
    assert.equal(stored.name, 'original.txt')
    assert.deepEqual(fs.readdirSync(tmpDir, { recursive: true }), entries)
  })

  it('retains complete new content with old metadata when the metadata rename fails', async (t) => {
    let storage = createFsFileStorage(tmpDir)
    let original = new File(['old'], 'old.txt', { type: 'text/plain', lastModified: 123 })
    await storage.set('file', original)
    let entries = fs.readdirSync(tmpDir, { recursive: true })
    let metaPath = findMetadataPath(tmpDir)
    let metadata = fs.readFileSync(metaPath, 'utf-8')
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

    assert.equal(rename.mock.calls.length, 2)
    assert.equal(fs.readFileSync(metaPath, 'utf-8'), metadata)
    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'replacement content')
    assert.equal(stored.size, replacement.size)
    assert.equal(stored.name, original.name)
    assert.equal(stored.type, original.type)
    assert.equal(stored.lastModified, original.lastModified)
    assert.equal((await storage.list({ includeMetadata: true })).files[0].size, original.size)
    assert.deepEqual(fs.readdirSync(tmpDir, { recursive: true }), entries)

    rename.mock.restore?.()
    await storage.set('file', replacement)
    let repaired = await storage.get('file')
    assert.ok(repaired)
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
    let files = fs.readdirSync(tmpDir, { recursive: true, withFileTypes: true })
    assert.equal(files.filter((file) => file.isFile()).length, 1)
    assert.ok(files.some((file) => file.name.endsWith('.dat')))
    assert.ok(files.every((file) => !file.name.endsWith('.upload')))
    await storage.remove('file')
    assert.equal(await storage.get('file'), null)
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

  it('replaces entries without reading their existing metadata', async (t) => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let metaPath = findMetadataPath(tmpDir)
    let originalReadFile = fsp.readFile
    let readFile = t.mock.method(
      fsp,
      'readFile',
      async (...args: Parameters<typeof fsp.readFile>) => {
        assert.notEqual(args[0], metaPath, 'Replacement should not read existing metadata')
        return originalReadFile(...args)
      },
    )

    await storage.set('file', new File(['replacement'], 'new.txt'))

    readFile.mock.restore?.()
    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'replacement')
    assert.equal(stored.name, 'new.txt')
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

    fs.writeFileSync(dataPath, 'old')
    fs.writeFileSync(metaPath, JSON.stringify(originalMetadata))
    let reopened = await createFsFileStorage(tmpDir).get('file')
    assert.ok(reopened)
    assert.equal(await reopened.text(), 'old')
    assert.equal(reopened.name, 'old.txt')
    await storage.remove('file')
    assert.deepEqual(fs.readdirSync(tmpDir), [])
  })

  it('keeps a successful replacement successful when temporary cleanup fails', async (t) => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let failure = new Error('Temporary file cleanup failed')
    t.mock.method(fsp, 'rm', async () => {
      throw failure
    })

    let stored = await storage.put('file', new File(['replacement'], 'new.txt'))

    assert.equal(await stored.text(), 'replacement')
    assert.equal(stored.name, 'new.txt')
    assert.deepEqual((await storage.list()).files, [{ key: 'file' }])
  })

  it('ignores abandoned sibling uploads and leaves them intact during replacement', async () => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let metaPath = findMetadataPath(tmpDir)
    let uploadId = crypto.randomUUID()
    let dataPath = metaPath.replace(/\.meta\.json$/, '.dat')
    let abandonedData = `${dataPath}.${uploadId}.upload`
    let abandonedMetadata = `${metaPath}.${uploadId}.upload`
    fs.writeFileSync(abandonedData, 'incomplete')
    fs.copyFileSync(metaPath, abandonedMetadata)
    let originalMetadata = fs.readFileSync(abandonedMetadata, 'utf-8')

    let reopened = createFsFileStorage(tmpDir)
    let stored = await reopened.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'original')
    assert.deepEqual((await reopened.list()).files, [{ key: 'file' }])
    await reopened.set('file', new File(['replacement'], 'new.txt'))
    assert.equal(fs.readFileSync(abandonedData, 'utf-8'), 'incomplete')
    assert.equal(fs.readFileSync(abandonedMetadata, 'utf-8'), originalMetadata)
    assert.deepEqual(
      fs.readdirSync(path.dirname(metaPath)).sort(),
      [
        path.basename(dataPath),
        path.basename(abandonedData),
        path.basename(metaPath),
        path.basename(abandonedMetadata),
      ].sort(),
    )
  })

  it('stages files beside their destinations without creating a temporary directory', async (t) => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let metaPath = findMetadataPath(tmpDir)
    let directory = path.dirname(metaPath)
    let originalRename = fsp.rename
    let sources: string[] = []
    t.mock.method(fsp, 'rename', async (source: fs.PathLike, destination: fs.PathLike) => {
      assert.equal(path.dirname(String(source)), directory)
      assert.equal(path.dirname(String(destination)), directory)
      assert.ok(String(source).endsWith('.upload'))
      sources.push(String(source))
      return originalRename(source, destination)
    })

    await storage.set('file', new File(['replacement'], 'new.txt'))
    await storage.set('file', new File(['another replacement'], 'newer.txt'))

    assert.equal(sources.length, 4)
    assert.equal(new Set(sources).size, 4)
    assert.ok(fs.readdirSync(directory, { withFileTypes: true }).every((entry) => entry.isFile()))
  })

  it('does not remove an existing temporary metadata file when exclusive creation fails', async (t) => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let metaPath = findMetadataPath(tmpDir)
    let uploadId = crypto.randomUUID()
    let occupiedPath = `${metaPath}.${uploadId}.upload`
    fs.writeFileSync(occupiedPath, 'existing upload')
    t.mock.method(crypto, 'randomUUID', () => uploadId)

    await assert.rejects(async () => storage.set('file', new File(['replacement'], 'new.txt')), {
      code: 'EEXIST',
    })

    assert.equal(fs.readFileSync(occupiedPath, 'utf-8'), 'existing upload')
    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'original')
    assert.deepEqual(
      fs.readdirSync(path.dirname(metaPath)).sort(),
      [
        path.basename(metaPath.replace(/\.meta\.json$/, '.dat')),
        path.basename(metaPath),
        path.basename(occupiedPath),
      ].sort(),
    )
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
      let reopened = createFsFileStorage(tmpDir)
      let stored = await reopened.get('avatar')
      assert.ok(stored)
      assert.equal(await stored.text(), 'new avatar')
      assert.equal(stored.name, 'avatar.txt')
      assert.equal(stored.type, normalizeFileType('text/plain'))
      assert.equal(stored.size, 10)
      assert.equal((await reopened.list({ includeMetadata: true })).files[0].size, 10)
    })

    it('preserves the previous entry when a streaming upload exceeds its size limit', async () => {
      let storage = createFsFileStorage(tmpDir)
      await storage.set('avatar', new File(['old avatar'], 'old.txt'))
      let entries = fs.readdirSync(tmpDir, { recursive: true })
      let body = new FormData()
      body.set('avatar', new File(['replacement avatar'], 'new.txt'))
      let request = new Request('http://example.com', { method: 'POST', body })

      await assert.rejects(
        () =>
          parseFutureFormData(request, { maxFileSize: 4 }, async (upload) => {
            await storage.set('avatar', upload)
            return 'avatar'
          }),
        MaxFileSizeExceededError,
      )

      let stored = await storage.get('avatar')
      assert.ok(stored)
      assert.equal(await stored.text(), 'old avatar')
      assert.equal(stored.name, 'old.txt')
      assert.deepEqual(fs.readdirSync(tmpDir, { recursive: true }), entries)
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
