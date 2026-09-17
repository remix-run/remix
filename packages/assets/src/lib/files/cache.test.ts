import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createFsFileStorage } from '@remix-run/file-storage/fs'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createDefaultFileCache } from './cache.ts'

describe('default file cache', () => {
  it('preserves file bytes and metadata across replacements and restarts', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createDefaultFileCache(directory)
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
      let restarted = createDefaultFileCache(directory)
      await assertCachedFile(await restarted.get('any key/☃'), replacement)
      assert.equal((await createFsFileStorage(directory).list()).files.length, 1)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('bounds disk entries across restarts and treats replaced keys as misses', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      for (let round = 0; round < 2; round++) {
        let cache = createDefaultFileCache(directory)
        for (let index = 0; index < 257; index++) {
          let key = `${round}:${index}`
          await cache.put(key, new File([key], `${key}.txt`))
        }
        let misses = 0
        for (let index = 0; index < 257; index++) {
          let key = `${round}:${index}`
          let file = await cache.get(key)
          if (file === null) {
            misses += 1
          } else {
            assert.equal(await file.text(), key)
            assert.equal(file.name, `${key}.txt`)
          }
        }
        assert.ok(misses > 0)
        let entries = await createFsFileStorage(directory).list({ limit: 1000 })
        assert.ok(entries.files.length <= 256)
      }
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('treats incomplete and mixed record bytes as misses independently of storage metadata', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createDefaultFileCache(directory)
      let original = new File([new Uint8Array([1, 2, 3])], 'image.png', {
        type: 'image/png',
        lastModified: 123456,
      })
      await cache.put('key', original)
      let storage = createFsFileStorage(directory)
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
      await storage.set(entry.key, new File([bytes.subarray(0, 80)], 'file-cache'))
      assert.equal(await cache.get('key'), null)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('treats incomplete storage metadata as a miss', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createDefaultFileCache(directory)
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

  it('serves hits or misses when separate caches write colliding slots concurrently', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let first = createDefaultFileCache(directory)
      let second = createDefaultFileCache(directory)
      let results = await Promise.allSettled(
        Array.from({ length: 257 }, async (_, index) => {
          let key = `key-${index}`
          await first.put(key, new File([key], 'file.txt'))
          let file = await second.get(key)
          if (file !== null) assert.equal(await file.text(), key)
          await second.put(key, new File([key], 'file.txt'))
        }),
      )
      for (let result of results) {
        if (result.status === 'rejected') throw result.reason
      }
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('includes record metadata in the stored size limit', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'file-cache-'))
    try {
      let cache = createDefaultFileCache(directory)
      let original = new File([], 'image.png', { type: 'image/png', lastModified: 123456 })
      await cache.put('key', original)
      let storage = createFsFileStorage(directory)
      let [entry] = (await storage.list()).files
      assert.ok(entry)
      let record = await storage.get(entry.key)
      assert.ok(record)
      let body = new Uint8Array(4 * 1024 * 1024 - record.size)
      let atLimit = new File([body], original.name, original)
      await cache.put('key', atLimit)
      await assertCachedFile(await cache.get('key'), atLimit)
      assert.equal((await storage.get(entry.key))?.size, 4 * 1024 * 1024)
      await storage.remove(entry.key)
      await cache.put('key', new File([body, 'x'], original.name, original))
      assert.equal(await cache.get('key'), null)
      assert.equal((await storage.list()).files.length, 0)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
})

async function assertCachedFile(actual: File | null, expected: File): Promise<void> {
  assert.ok(actual)
  assert.equal(actual.name, expected.name)
  assert.equal(actual.type, expected.type)
  assert.equal(actual.lastModified, expected.lastModified)
  assert.deepEqual(await actual.arrayBuffer(), await expected.arrayBuffer())
}
