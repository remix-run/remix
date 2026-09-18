import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createFsFileStorage } from '@remix-run/file-storage/fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createFsFileCache } from '../../assets.ts'

describe('createFsFileCache', () => {
  it('defaults to a cache directory under cwd and accepts limits without a directory', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-default-'))
    try {
      let source = `
        import { createFsFileCache } from ${JSON.stringify(new URL('../../assets.ts', import.meta.url).href)}
        let cache = createFsFileCache()
        await cache.put('a', new File(['a'], 'file.txt'))
        let limited = createFsFileCache({ maxEntries: 1 })
        await limited.put('b', new File(['b'], 'file.txt'))
        if (await limited.get('a') !== null) throw new Error('Entry limit was not applied')
        let restarted = createFsFileCache()
        if (await (await restarted.get('b'))?.text() !== 'b') {
          throw new Error('Default cache directory was not reused')
        }
      `
      await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source], {
        cwd: directory,
      })
      let storage = createFsFileStorage(
        path.join(directory, 'node_modules/.cache/remix/assets/files'),
      )
      assert.equal((await storage.list()).files.length, 1)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('preserves file bytes and metadata across replacements and restarts', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory: path.relative(process.cwd(), directory) })
      let original = new File([new Uint8Array([0, 255, 10])], 'image\n☃.png', {
        type: 'image/png',
        lastModified: 123456,
      })
      await cache.put('any key/☃', original)
      await assertCachedFile(await cache.get('any key/☃'), original)
      let replacement = new File(['new'], 'image.webp', {
        type: 'image/webp',
        lastModified: 654321,
      })
      await cache.put('any key/☃', replacement)
      let restarted = createFsFileCache({ directory })
      await assertCachedFile(await restarted.get('any key/☃'), replacement)
      assert.equal(
        (await createFsFileStorage(path.join(directory, 'files')).list()).files.length,
        1,
      )
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('evicts the least recently used entry after a cache hit', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory, maxEntries: 2 })
      await cache.put('a', new File(['a'], 'a.txt'))
      await cache.put('b', new File(['b'], 'b.txt'))
      assert.equal(await (await cache.get('a'))?.text(), 'a')
      await cache.put('c', new File(['c'], 'c.txt'))
      assert.equal(await cache.get('b'), null)
      assert.equal(await (await cache.get('a'))?.text(), 'a')
      assert.equal(await (await cache.get('c'))?.text(), 'c')
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('rebuilds recency from record timestamps instead of previous reads', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory, maxEntries: 2 })
      await cache.put('a', new File(['a'], 'file.txt', { lastModified: 100 }))
      let storage = createFsFileStorage(path.join(directory, 'files'))
      let [first] = (await storage.list()).files
      assert.ok(first)
      let record = await storage.get(first.key)
      assert.ok(record)
      await storage.put(
        first.key,
        new File([await record.arrayBuffer()], record.name, { lastModified: 1 }),
      )
      await cache.put('b', new File(['b'], 'file.txt', { lastModified: 0 }))
      await cache.get('a')

      let restarted = createFsFileCache({ directory, maxEntries: 2 })
      await restarted.put('c', new File(['c'], 'file.txt'))
      assert.equal(await restarted.get('a'), null)
      assert.equal(await (await restarted.get('b'))?.text(), 'b')
      assert.equal(await (await restarted.get('c'))?.text(), 'c')
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('does not write filesystem metadata for cache hits or misses after initialization', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory })
      await cache.put('a', new File(['a'], 'file.txt'))
      await cache.put('b', new File(['b'], 'file.txt'))
      let files = await fs.readdir(directory, { recursive: true })
      for (let file of [...files, '.']) {
        await fs.utimes(path.join(directory, file), new Date(0), new Date(0))
      }
      let before = await snapshotCacheDirectory(directory)
      assert.equal(await (await cache.get('a'))?.text(), 'a')
      assert.equal(await cache.get('missing'), null)
      assert.equal(await (await cache.get('b'))?.text(), 'b')
      assert.deepEqual(await snapshotCacheDirectory(directory), before)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('bounds disk entries across restarts and fills every available entry', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      for (let round = 0; round < 2; round++) {
        let cache = createFsFileCache({ directory, maxEntries: 4 })
        for (let index = 0; index < 5; index++) {
          let key = `${round}:${index}`
          await cache.put(key, new File([key], `${key}.txt`))
        }
        let misses = 0
        for (let index = 0; index < 5; index++) {
          let key = `${round}:${index}`
          let file = await cache.get(key)
          if (file === null) {
            misses += 1
          } else {
            assert.equal(await file.text(), key)
            assert.equal(file.name, `${key}.txt`)
          }
        }
        assert.equal(misses, 1)
        let entries = await createFsFileStorage(path.join(directory, 'files')).list({ limit: 1000 })
        assert.equal(entries.files.length, 4)
      }
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('treats incomplete and mixed record bytes as misses independently of storage metadata', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory })
      let original = new File([new Uint8Array([1, 2, 3])], 'image.png', {
        type: 'image/png',
        lastModified: 123456,
      })
      await cache.put('key', original)
      let storage = createFsFileStorage(path.join(directory, 'files'))
      let [entry] = (await storage.list()).files
      assert.ok(entry)
      let record = await storage.get(entry.key)
      assert.ok(record)
      let bytes = new Uint8Array(await record.arrayBuffer())
      await storage.set(entry.key, new File([bytes], 'other.webp', { type: 'image/webp' }))
      await assertCachedFile(await cache.get('key'), original)
      bytes[bytes.length - 1] = 4
      await storage.set(entry.key, new File([bytes], 'file-cache'))
      assert.equal(await cache.get('key'), null)
      await cache.put('key', original)
      await storage.set(entry.key, new File([bytes.subarray(0, 80)], 'file-cache'))
      assert.equal(await cache.get('key'), null)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('treats incomplete storage metadata as a miss', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory })
      await cache.put('key', new File(['hello'], 'file.txt'))
      let entries = await fs.readdir(directory, { recursive: true })
      let metadataPath = entries.find((entry) => entry.endsWith('.meta.json'))
      assert.ok(metadataPath)
      await fs.writeFile(path.join(directory, metadataPath), '{')
      assert.equal(await cache.get('key'), null)
      await cache.put('key', new File(['replacement'], 'file.txt'))
      assert.equal(await (await cache.get('key'))?.text(), 'replacement')
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('does not delete a replacement when an overlapping read finds a corrupt record', async (t) => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    let started = Promise.withResolvers<void>()
    let resume = Promise.withResolvers<void>()
    try {
      let cache = createFsFileCache({ directory })
      await cache.put('a', new File(['original'], 'file.txt'))
      let storage = createFsFileStorage(path.join(directory, 'files'))
      let [entry] = (await storage.list()).files
      assert.ok(entry)
      let record = await storage.get(entry.key)
      assert.ok(record)
      let bytes = new Uint8Array(await record.arrayBuffer())
      bytes[bytes.length - 1] = 33
      await storage.put(entry.key, new File([bytes], 'file-cache'))

      let digest = crypto.subtle.digest.bind(crypto.subtle)
      t.mock.method(
        crypto.subtle,
        'digest',
        async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
          let input = ArrayBuffer.isView(data)
            ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            : new Uint8Array(data)
          if (new TextDecoder().decode(input).endsWith('origina!')) {
            started.resolve()
            await resume.promise
          }
          return digest(algorithm, data)
        },
      )
      let reading = cache.get('a')
      await started.promise
      await cache.put('a', new File(['replacement'], 'file.txt'))
      resume.resolve()
      assert.equal(await reading, null)
      assert.equal(await (await cache.get('a'))?.text(), 'replacement')
    } finally {
      resume.resolve()
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('bounds concurrent writes within one cache instance', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory, maxEntries: 8 })
      let results = await Promise.allSettled(
        Array.from({ length: 32 }, async (_, index) => {
          let key = `key-${index}`
          await cache.put(key, new File([key], 'file.txt'))
          let file = await cache.get(key)
          if (file !== null) assert.equal(await file.text(), key)
          await cache.put(key, new File([key], 'file.txt'))
        }),
      )
      for (let result of results) {
        if (result.status === 'rejected') throw result.reason
      }
      let entries = await createFsFileStorage(path.join(directory, 'files')).list()
      assert.ok(entries.files.length > 0)
      assert.ok(entries.files.length <= 8)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('includes record metadata in the stored size limit', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory, maxFileSize: 512 })
      let original = new File([], 'image.png', { type: 'image/png', lastModified: 123456 })
      await cache.put('key', original)
      let storage = createFsFileStorage(path.join(directory, 'files'))
      let [entry] = (await storage.list()).files
      assert.ok(entry)
      let record = await storage.get(entry.key)
      assert.ok(record)
      let body = new Uint8Array(512 - record.size)
      let atLimit = new File([body], original.name, original)
      await cache.put('key', atLimit)
      await assertCachedFile(await cache.get('key'), atLimit)
      assert.equal((await storage.get(entry.key))?.size, 512)
      await storage.remove(entry.key)
      await cache.put('key', new File([body, 'x'], original.name, original))
      assert.equal(await cache.get('key'), null)
      assert.equal((await storage.list()).files.length, 0)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
  it('evicts by total stored bytes and counts replacement sizes correctly', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let original = new File(['x'], 'file.txt', { lastModified: 0 })
      let cache = createFsFileCache({ directory })
      await cache.put('a', original)
      let storage = createFsFileStorage(path.join(directory, 'files'))
      let [entry] = (await storage.list({ includeMetadata: true })).files
      assert.ok(entry)
      let size = entry.size
      cache = createFsFileCache({ directory, maxTotalSize: 2 * size, maxEntries: 10 })
      await cache.put('b', original)
      await cache.get('a')
      await cache.put('c', original)
      assert.equal(await cache.get('b'), null)
      await assertCachedFile(await cache.get('a'), original)
      await assertCachedFile(await cache.get('c'), original)
      await cache.put('a', new File(['xx'], original.name, original))
      assert.equal(await cache.get('c'), null)
      assert.equal(await (await cache.get('a'))?.text(), 'xx')
      let entries = (await storage.list({ includeMetadata: true })).files
      assert.equal(entries.length, 1)
      assert.equal(entries[0].size, size + 1)
      await cache.put('a', original)
      await cache.put('b', original)
      assert.equal((await storage.list()).files.length, 2)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('refreshes recency when replacing an entry', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory, maxEntries: 2 })
      await cache.put('a', new File(['a'], 'file.txt'))
      await cache.put('b', new File(['b'], 'file.txt'))
      await cache.put('a', new File(['updated'], 'file.txt'))
      await cache.put('c', new File(['c'], 'file.txt'))
      assert.equal(await cache.get('b'), null)
      assert.equal(await (await cache.get('a'))?.text(), 'updated')
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('enforces smaller limits when reopening a directory', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory })
      await cache.put('a', new File(['a'], 'file.txt'))
      await cache.put('b', new File(['b'], 'file.txt'))
      await cache.put('c', new File(['c'], 'file.txt'))
      cache = createFsFileCache({ directory, maxEntries: 1 })
      let files = await Promise.all(['a', 'b', 'c'].map((key) => cache.get(key)))
      assert.equal(files.filter((file) => file !== null).length, 1)
      assert.equal(
        (await createFsFileStorage(path.join(directory, 'files')).list()).files.length,
        1,
      )
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('allows a configured file limit larger than the default', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory, maxFileSize: 8 * 1024 * 1024 })
      let file = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.bin')
      await cache.put('large', file)
      await assertCachedFile(await cache.get('large'), file)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('declines entries larger than the total byte budget', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory, maxFileSize: 4096, maxTotalSize: 256 })
      await cache.put('key', new File([new Uint8Array(257)], 'file.txt'))
      assert.equal(await cache.get('key'), null)
      assert.equal(
        (await createFsFileStorage(path.join(directory, 'files')).list()).files.length,
        0,
      )
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('recovers an interrupted write without retaining unaccounted records', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory })
      await cache.put('a', new File(['a'], 'file.txt'))
      let storage = createFsFileStorage(path.join(directory, 'files'))
      await fs.writeFile(path.join(directory, 'pending'), '')
      await storage.put('uncommitted', new File(['uncommitted'], 'file.txt'))
      let restarted = createFsFileCache({ directory })
      assert.equal(await restarted.get('a'), null)
      assert.equal((await storage.list()).files.length, 0)
      await restarted.put('b', new File(['b'], 'file.txt'))
      assert.equal(await (await restarted.get('b'))?.text(), 'b')
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('recovers from corrupt storage metadata when rebuilding the index', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory })
      await cache.put('a', new File(['a'], 'file.txt'))
      let files = await fs.readdir(directory, { recursive: true })
      let metadata = files.find((file) => file.endsWith('.meta.json'))
      assert.ok(metadata)
      await fs.writeFile(path.join(directory, metadata), '{')
      let restarted = createFsFileCache({ directory })
      assert.equal(await restarted.get('a'), null)
      assert.equal(
        (await createFsFileStorage(path.join(directory, 'files')).list()).files.length,
        0,
      )
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('reuses records after the writing process exits', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let source = `
        import { createFsFileCache } from ${JSON.stringify(new URL('../../assets.ts', import.meta.url).href)}
        let cache = createFsFileCache({ directory: process.argv[1] })
        await cache.put('a', new File(['a'], 'file.txt', { lastModified: 123 }))
      `
      await promisify(execFile)(process.execPath, ['--input-type=module', '-e', source, directory])
      let cache = createFsFileCache({ directory })
      await assertCachedFile(
        await cache.get('a'),
        new File(['a'], 'file.txt', { lastModified: 123 }),
      )
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('recovers from a failed write before admitting more entries', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory, maxEntries: 1 })
      await cache.put('a', new File(['a'], 'file.txt'))
      let files = await fs.readdir(directory, { recursive: true })
      let body = files.find((file) => file.endsWith('.dat'))
      assert.ok(body)
      let bodyPath = path.join(directory, body)
      await fs.unlink(bodyPath)
      await fs.mkdir(bodyPath)
      await assert.rejects(async () => cache.put('a', new File(['replacement'], 'file.txt')))
      await cache.put('b', new File(['b'], 'file.txt'))
      assert.equal(await cache.get('a'), null)
      assert.equal(await (await cache.get('b'))?.text(), 'b')
      assert.equal(
        (await createFsFileStorage(path.join(directory, 'files')).list()).files.length,
        1,
      )
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('discards invalid accounting metadata on restart', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory })
      await cache.put('a', new File(['a'], 'file.txt'))
      let files = await fs.readdir(directory, { recursive: true })
      let metadata = files.find((file) => file.endsWith('.meta.json'))
      assert.ok(metadata)
      await fs.writeFile(path.join(directory, metadata), '{}')
      let restarted = createFsFileCache({ directory })
      assert.equal(await restarted.get('a'), null)
      await restarted.put('b', new File(['b'], 'file.txt'))
      assert.equal(
        (await createFsFileStorage(path.join(directory, 'files')).list()).files.length,
        1,
      )
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('treats a missing backing file as a miss and allows it to be replaced', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createFsFileCache({ directory })
      await cache.put('a', new File(['a'], 'file.txt'))
      let files = await fs.readdir(directory, { recursive: true })
      let body = files.find((file) => file.endsWith('.dat'))
      assert.ok(body)
      await fs.unlink(path.join(directory, body))
      assert.equal(await cache.get('a'), null)
      await cache.put('a', new File(['replacement'], 'file.txt'))
      assert.equal(await (await cache.get('a'))?.text(), 'replacement')
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('rejects invalid limits before creating the cache directory', async () => {
    let directory = path.join(os.tmpdir(), `file-cache-${crypto.randomUUID()}`)
    assert.throws(() => createFsFileCache({ directory, maxEntries: 0 }), /maxEntries/)
    assert.throws(() => createFsFileCache({ directory, maxEntries: 1.5 }), /maxEntries/)
    assert.throws(() => createFsFileCache({ directory, maxFileSize: -1 }), /maxFileSize/)
    assert.throws(() => createFsFileCache({ directory, maxFileSize: NaN }), /maxFileSize/)
    assert.throws(() => createFsFileCache({ directory, maxTotalSize: Infinity }), /maxTotalSize/)
    assert.throws(
      () => createFsFileCache({ directory, maxTotalSize: Number.MAX_SAFE_INTEGER + 1 }),
      /maxTotalSize/,
    )
    await assert.rejects(() => fs.stat(directory), /ENOENT/)
  })
})

async function snapshotCacheDirectory(directory: string) {
  let files = await fs.readdir(directory, { recursive: true })
  return Promise.all(
    [...files, '.'].sort().map(async (file) => {
      let stat = await fs.stat(path.join(directory, file))
      return { file, size: stat.size, mtime: stat.mtimeMs }
    }),
  )
}

async function assertCachedFile(actual: File | null, expected: File): Promise<void> {
  assert.ok(actual)
  assert.equal(actual.name, expected.name)
  assert.equal(actual.type, expected.type)
  assert.equal(actual.lastModified, expected.lastModified)
  assert.deepEqual(await actual.arrayBuffer(), await expected.arrayBuffer())
}
