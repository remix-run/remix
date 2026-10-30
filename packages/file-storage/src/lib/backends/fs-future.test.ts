import * as assert from '@remix-run/assert'
import { afterEach, beforeEach, describe, it } from '@remix-run/test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { LazyFile } from '@remix-run/lazy-file'

import type { FileStorage } from '../file-storage.ts'
import { createFsFileStorage } from '../../fs-future.ts'
import { createFsFileStorage as createLegacyFsFileStorage } from '../../fs.ts'
import {
  MaxFileSizeExceededError,
  parseFormData as parseFutureFormData,
} from '@remix-run/form-data-parser/future'

// Compile-time API contract: the future backend returns LazyFile values through FileStorage.
null as unknown as ReturnType<typeof createFsFileStorage> satisfies FileStorage<LazyFile>

function normalizeFileType(type: string): string {
  return new File([''], '', { type }).type
}

async function writeLegacyFile(directory: string, key: string, file: File) {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  let hash = Buffer.from(digest).toString('hex')
  let subdir = path.join(directory, hash.slice(0, 2))
  await createLegacyFsFileStorage(directory).set(key, file)
  let dataPath = path.join(subdir, `${hash}.dat`)
  let metaPath = path.join(subdir, `${hash}.meta.json`)
  return { dataPath, metaPath }
}

describe('future fs file storage', () => {
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

  it('lists stored file metadata after reopening', async () => {
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

  it('lists concurrent writes with pagination', async () => {
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
    for (let { key } of files) {
      let stored = await storage.get(key)
      assert.ok(stored)
      assert.equal(await stored.text(), `Hello ${key}!`)
    }

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

  it('preserves the legacy entry when an atomic upload fails', async () => {
    let storage = createFsFileStorage(tmpDir)
    let original = new File(['original content'], 'original.txt', { type: 'text/plain' })
    await writeLegacyFile(tmpDir, 'file', original)
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

  it('preserves restrictive permissions while migrating a legacy entry', async () => {
    let { dataPath, metaPath } = await writeLegacyFile(tmpDir, 'file', new File(['old'], 'old.txt'))
    fs.chmodSync(dataPath, 0o600)
    fs.chmodSync(metaPath, 0o660)
    let dataMode = fs.statSync(dataPath).mode & 0o777
    let metaMode = fs.statSync(metaPath).mode & 0o777
    let storage = createFsFileStorage(tmpDir)
    let upload = new File(['replacement'], 'new.txt')
    let stream = upload.stream.bind(upload)
    upload.stream = function () {
      let staged = fs
        .readdirSync(path.dirname(dataPath))
        .find((name) => name.endsWith('.dat') && name !== path.basename(dataPath))
      assert.ok(staged)
      assert.equal(fs.statSync(path.join(path.dirname(dataPath), staged)).mode & 0o777, dataMode)
      return stream()
    }

    let stored = await storage.put('file', upload)

    assert.equal(await stored.text(), 'replacement')
    let content = fs.readdirSync(path.dirname(metaPath)).find((name) => name.endsWith('.dat'))
    assert.ok(content)
    assert.equal(fs.statSync(path.join(path.dirname(metaPath), content)).mode & 0o777, dataMode)
    assert.equal(fs.statSync(metaPath).mode & 0o777, metaMode)
  })

  it('preserves separate content and metadata permissions when replacing a migrated entry', async () => {
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['original'], 'original.txt'))
    let entries = fs.readdirSync(tmpDir, { recursive: true, encoding: 'utf-8' })
    let content = entries.find((name) => name.endsWith('.dat'))
    let metadata = entries.find((name) => name.endsWith('.meta.json'))
    assert.ok(content)
    assert.ok(metadata)
    let metaPath = path.join(tmpDir, metadata)
    fs.chmodSync(path.join(tmpDir, content), 0o640)
    fs.chmodSync(metaPath, 0o600)
    let dataMode = fs.statSync(path.join(tmpDir, content)).mode & 0o777
    let metaMode = fs.statSync(metaPath).mode & 0o777

    await createFsFileStorage(tmpDir).set('file', new File(['replacement'], 'new.txt'))

    let replacement = fs.readdirSync(path.dirname(metaPath)).find((name) => name.endsWith('.dat'))
    assert.ok(replacement)
    assert.equal(fs.statSync(path.join(path.dirname(metaPath), replacement)).mode & 0o777, dataMode)
    assert.equal(fs.statSync(metaPath).mode & 0o777, metaMode)
    let stored = await storage.get('file')
    assert.ok(stored)
    assert.equal(await stored.text(), 'replacement')
  })

  it('preserves restrictive permissions when recovering corrupt metadata', async () => {
    let { dataPath, metaPath } = await writeLegacyFile(tmpDir, 'file', new File(['old'], 'old.txt'))
    let abandonedPath = dataPath.replace(/\.dat$/, `.${crypto.randomUUID()}.dat`)
    fs.writeFileSync(abandonedPath, 'abandoned')
    fs.writeFileSync(metaPath, '{')
    fs.chmodSync(dataPath, 0o600)
    fs.chmodSync(abandonedPath, 0o640)
    fs.chmodSync(metaPath, 0o600)
    let dataMode = fs.statSync(dataPath).mode & fs.statSync(abandonedPath).mode & 0o777
    let metaMode = fs.statSync(metaPath).mode & 0o777

    await createFsFileStorage(tmpDir).set('file', new File(['replacement'], 'new.txt'))

    let content = fs.readdirSync(path.dirname(metaPath)).find((name) => name.endsWith('.dat'))
    assert.ok(content)
    assert.equal(fs.statSync(path.join(path.dirname(metaPath), content)).mode & 0o777, dataMode)
    assert.equal(fs.statSync(metaPath).mode & 0o777, metaMode)
  })

  it('uses existing metadata permissions when replacing missing content', async () => {
    let { dataPath, metaPath } = await writeLegacyFile(tmpDir, 'file', new File(['old'], 'old.txt'))
    fs.unlinkSync(dataPath)
    fs.chmodSync(metaPath, 0o600)
    let metaMode = fs.statSync(metaPath).mode & 0o777
    let storage = createFsFileStorage(tmpDir)

    let stored = await storage.put('file', new File(['replacement'], 'new.txt'))

    assert.equal(await stored.text(), 'replacement')
    let content = fs.readdirSync(path.dirname(metaPath)).find((name) => name.endsWith('.dat'))
    assert.ok(content)
    assert.equal(fs.statSync(path.join(path.dirname(metaPath), content)).mode & 0o777, metaMode)
    assert.equal(fs.statSync(metaPath).mode & 0o777, metaMode)
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

    let replacement = new File(['replacement'], 'replacement.txt', {
      type: 'text/plain',
      lastModified: 123,
    })
    let stored = await createFsFileStorage(tmpDir).put('file', replacement)
    assert.ok(stored instanceof LazyFile)
    assert.equal(stored.name, replacement.name)
    assert.equal(stored.type, replacement.type)
    assert.equal(stored.size, replacement.size)
    assert.equal(stored.lastModified, replacement.lastModified)
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
    let originalMetadata = fs.readFileSync(metaPath, 'utf-8')
    let storage = createFsFileStorage(tmpDir)
    let stored = await storage.get('legacy')
    assert.ok(stored)
    assert.equal(await stored.text(), 'legacy content')
    assert.equal(stored.name, original.name)
    assert.equal(stored.type, original.type)
    assert.equal(stored.lastModified, original.lastModified)
    assert.equal(await storage.has('legacy'), true)
    assert.deepEqual((await storage.list()).files, [{ key: 'legacy' }])
    assert.equal(fs.readFileSync(metaPath, 'utf-8'), originalMetadata)
    assert.equal(fs.readFileSync(dataPath, 'utf-8'), 'legacy content')

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
    assert.equal(fs.readFileSync(unrelatedPath, 'utf-8'), 'unrelated')
    assert.equal(fs.readFileSync(dataPath, 'utf-8'), 'original')
    await storage.remove('file')
    assert.equal(fs.readFileSync(unrelatedPath, 'utf-8'), 'unrelated')
    assert.equal(fs.existsSync(dataPath), false)
    assert.equal(await storage.has('file'), false)
  })

  it('replaces corrupt metadata without following its content pointer', async () => {
    let { metaPath } = await writeLegacyFile(tmpDir, 'file', new File(['old'], 'old.txt'))
    let record: unknown = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    assert.ok(record !== null && typeof record === 'object')
    fs.writeFileSync(metaPath, JSON.stringify({ ...record, dataFile: '../unrelated.dat' }))
    let unrelatedPath = path.join(tmpDir, 'unrelated.dat')
    fs.writeFileSync(unrelatedPath, 'unrelated')
    let storage = createFsFileStorage(tmpDir)

    let stored = await storage.put('file', new File(['replacement'], 'new.txt'))

    assert.equal(await stored.text(), 'replacement')
    assert.equal(fs.readFileSync(unrelatedPath, 'utf-8'), 'unrelated')
    await storage.remove('file')
    assert.equal(fs.readFileSync(unrelatedPath, 'utf-8'), 'unrelated')
  })

  it('recovers corrupt versioned entries atomically after reopening', async () => {
    let { dataPath, metaPath } = await writeLegacyFile(tmpDir, 'file', new File(['old'], 'old.txt'))
    await createFsFileStorage(tmpDir).set('file', new File(['migrated'], 'migrated.txt'))
    let storage = createFsFileStorage(tmpDir)
    let entries = fs.readdirSync(path.dirname(metaPath)).sort()
    let oldData = entries.find((name) => name.endsWith('.dat'))
    assert.ok(oldData)
    fs.writeFileSync(metaPath, '{')
    let upload = new File(['replacement'], 'new.txt')
    let failure = new Error('Metadata unavailable')
    Object.defineProperty(upload, 'name', {
      get() {
        throw failure
      },
    })

    await assert.rejects(async () => storage.put('file', upload), failure)

    assert.equal(fs.readFileSync(metaPath, 'utf-8'), '{')
    assert.equal(fs.readFileSync(path.join(path.dirname(metaPath), oldData), 'utf-8'), 'migrated')
    assert.deepEqual(fs.readdirSync(path.dirname(metaPath)).sort(), entries)
    let stored = await storage.put('file', new File(['replacement'], 'new.txt'))
    assert.equal(await stored.text(), 'replacement')
    assert.equal(fs.existsSync(dataPath), false)
    assert.equal(fs.readdirSync(path.dirname(metaPath)).length, 2)
    let record: unknown = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    assert.ok(record !== null && typeof record === 'object' && 'dataFile' in record)
  })

  it('removes a partial legacy upload when no metadata was published', async () => {
    let { metaPath } = await writeLegacyFile(
      tmpDir,
      'file',
      new File(['partial upload'], 'file.txt'),
    )
    fs.unlinkSync(metaPath)
    let storage = createFsFileStorage(tmpDir)
    assert.equal(await storage.has('file'), false)
    assert.equal(await storage.get('file'), null)

    await storage.remove('file')

    assert.deepEqual(fs.readdirSync(tmpDir), [])
    await storage.remove('file')
  })

  it('removes content for a key with corrupt metadata without removing unrelated files', async () => {
    let { dataPath, metaPath } = await writeLegacyFile(tmpDir, 'file', new File(['old'], 'old.txt'))
    let storage = createFsFileStorage(tmpDir)
    await storage.set('file', new File(['replacement'], 'new.txt'))
    fs.writeFileSync(dataPath, 'unused legacy content')
    fs.writeFileSync(path.join(path.dirname(metaPath), 'unrelated.dat'), 'unrelated')
    fs.writeFileSync(metaPath, '{')

    await storage.remove('file')

    assert.equal(await storage.get('file'), null)
    assert.equal(await storage.has('file'), false)
    assert.deepEqual(fs.readdirSync(path.dirname(metaPath)), ['unrelated.dat'])
  })

  it('reads and lists legacy entries without a stored size', async () => {
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
  })

  it('lists keys when a legacy entry has no stored size and its content is missing', async () => {
    let { dataPath, metaPath } = await writeLegacyFile(
      tmpDir,
      'legacy',
      new File(['legacy'], 'legacy.txt'),
    )
    let record: unknown = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    assert.ok(record !== null && typeof record === 'object')
    Reflect.deleteProperty(record, 'size')
    fs.writeFileSync(metaPath, JSON.stringify(record))
    fs.unlinkSync(dataPath)
    let storage = createFsFileStorage(tmpDir)
    await storage.set('healthy', new File(['healthy'], 'healthy.txt'))
    let expected = [{ key: 'healthy' }, { key: 'legacy' }]

    let { files } = await storage.list()
    assert.deepEqual(
      files.sort((a, b) => a.key.localeCompare(b.key)),
      expected,
    )

    await storage.remove('legacy')
    assert.equal(await storage.has('legacy'), false)
    assert.equal(await storage.get('legacy'), null)
    assert.equal(fs.existsSync(path.dirname(metaPath)), false)
    assert.deepEqual((await storage.list()).files, [{ key: 'healthy' }])
  })

  it('replaces a legacy entry with no stored size when its content is missing', async () => {
    let { dataPath, metaPath } = await writeLegacyFile(
      tmpDir,
      'legacy',
      new File(['legacy'], 'legacy.txt'),
    )
    let record: unknown = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    assert.ok(record !== null && typeof record === 'object')
    Reflect.deleteProperty(record, 'size')
    fs.writeFileSync(metaPath, JSON.stringify(record))
    fs.unlinkSync(dataPath)
    let storage = createFsFileStorage(tmpDir)
    let replacement = new File(['replacement'], 'new.txt', { type: 'text/plain' })

    await storage.set('legacy', replacement)

    let reopened = createFsFileStorage(tmpDir)
    let stored = await reopened.get('legacy')
    assert.ok(stored)
    assert.equal(await stored.text(), 'replacement')
    assert.equal(stored.name, replacement.name)
    assert.equal(stored.type, replacement.type)
    assert.equal(stored.size, replacement.size)
    assert.equal((await reopened.list({ includeMetadata: true })).files[0].size, replacement.size)
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
  })
})
