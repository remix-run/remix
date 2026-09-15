import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { createFsFileStorage } from '@remix-run/file-storage/fs'
import { createMemoryFileStorage } from '@remix-run/file-storage/memory'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createTransformCacheKey, readCachedTransform, writeCachedTransform } from './cache.ts'
import type { TransformCacheKey } from './cache.ts'

describe('transform cache', () => {
  it('replaces colliding filesystem entries without returning another transform', async () => {
    let directory = await fs.mkdtemp(path.join(os.tmpdir(), 'transform-cache-'))
    try {
      let cache = createFsFileStorage(directory)
      let keys = new Map<string, TransformCacheKey>()
      let collision: [TransformCacheKey, TransformCacheKey] | undefined
      for (let index = 0; index < 257; index++) {
        let key = await createTransformCacheKey('build-a', `transform:${index}`)
        let previous = keys.get(key.slot)
        if (previous) {
          collision = [previous, key]
          break
        }
        keys.set(key.slot, key)
      }
      assert.ok(collision)
      let [first, second] = collision
      let firstOutput = { body: new Uint8Array([0, 255, 10]), extension: '.png' }
      let secondOutput = { body: new Uint8Array([1, 2]), extension: '.webp' }
      await writeCachedTransform(cache, first, firstOutput)
      assert.deepEqual(await readCachedTransform(cache, first), firstOutput)

      await writeCachedTransform(cache, second, secondOutput)
      assert.equal(await readCachedTransform(cache, first), null)
      assert.deepEqual(await readCachedTransform(cache, second), secondOutput)
      assert.equal((await cache.list()).files.length, 1)

      let restartedCache = createFsFileStorage(directory)
      assert.equal(await readCachedTransform(restartedCache, first), null)
      assert.deepEqual(await readCachedTransform(restartedCache, second), secondOutput)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  it('treats incomplete and mixed cache contents as misses', async () => {
    let cache = createMemoryFileStorage()
    let key = await createTransformCacheKey('build-a', 'transform:a')
    await writeCachedTransform(cache, key, {
      body: new Uint8Array([1, 2, 3]),
      extension: '.png',
    })
    let file = await cache.get(key.slot)
    assert.ok(file)
    let bytes = new Uint8Array(await file.arrayBuffer())
    bytes[bytes.length - 1] = 4
    await cache.set(key.slot, new File([bytes], file.name))
    assert.equal(await readCachedTransform(cache, key), null)

    await cache.set(key.slot, new File([bytes.subarray(0, 80)], file.name))
    assert.equal(await readCachedTransform(cache, key), null)
  })

  it('reads identity and extension from the cached body independently of File metadata', async () => {
    let cache = createMemoryFileStorage()
    let key = await createTransformCacheKey('build-a', 'transform:a')
    let output = { body: new Uint8Array([1, 2, 3]), extension: '.png' }
    await writeCachedTransform(cache, key, output)
    let file = await cache.get(key.slot)
    assert.ok(file)
    await cache.set(key.slot, new File([await file.arrayBuffer()], 'other.webp'))
    assert.deepEqual(await readCachedTransform(cache, key), output)
  })

  it('includes cache metadata in the stored size limit', async () => {
    let cache = createMemoryFileStorage()
    let key = await createTransformCacheKey('build-a', 'transform:a')
    let body = new Uint8Array(4 * 1024 * 1024 - 135)
    await writeCachedTransform(cache, key, { body, extension: '.png' })
    let file = await cache.get(key.slot)
    assert.ok(file)
    assert.equal(file.size, 4 * 1024 * 1024)
    assert.deepEqual(await readCachedTransform(cache, key), { body, extension: '.png' })

    let other = await createTransformCacheKey('build-b', 'transform:a')
    await writeCachedTransform(cache, other, {
      body: new Uint8Array(body.length + 1),
      extension: '.png',
    })
    assert.equal(await cache.get(other.slot), null)
  })
})
