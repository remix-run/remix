import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMemoryFileStorage } from '@remix-run/file-storage/memory'
import { LazyFile } from '@remix-run/lazy-file'
import { createFileCache } from './file-cache.ts'

describe('createFileCache', () => {
  it('memoizes getOrSet for the same key', async () => {
    let storage = createMemoryFileStorage()
    let cache = createFileCache(storage, { version: 'v1' })
    let count = 0

    let first = await cache.getOrSet(['a', 1], async () => {
      count += 1
      return new File(['hello'], 'hello.txt', { type: 'text/plain' })
    })
    let second = await cache.getOrSet(['a', 1], async () => {
      count += 1
      return new File(['goodbye'], 'goodbye.txt', { type: 'text/plain' })
    })

    assert.equal(count, 1)
    assert.equal(await first.text(), 'hello')
    assert.equal(await second.text(), 'hello')
  })

  it('supports version pruning', async () => {
    let storage = createMemoryFileStorage()
    let oldCache = createFileCache(storage, { version: 'v1' })
    let newCache = createFileCache(storage, { version: 'v2' })

    await oldCache.set('asset', new File(['old'], 'a.txt', { type: 'text/plain' }))
    await newCache.set('asset', new File(['new'], 'b.txt', { type: 'text/plain' }))

    await newCache.prune()

    let oldValue = await oldCache.get('asset')
    let newValue = await newCache.get('asset')

    assert.equal(oldValue, null)
    if (!newValue) throw new Error('expected value to exist')
    assert.equal(await newValue.text(), 'new')
  })

  it('clears only the current version', async () => {
    let storage = createMemoryFileStorage()
    let cacheV1 = createFileCache(storage, { version: 'v1' })
    let cacheV2 = createFileCache(storage, { version: 'v2' })

    await cacheV1.set('file', new File(['v1'], 'v1.txt', { type: 'text/plain' }))
    await cacheV2.set('file', new File(['v2'], 'v2.txt', { type: 'text/plain' }))

    await cacheV2.clear()

    let valueV1 = await cacheV1.get('file')
    let valueV2 = await cacheV2.get('file')

    if (!valueV1) throw new Error('expected value to exist')
    assert.equal(await valueV1.text(), 'v1')
    assert.equal(valueV2, null)
  })

  it('evicts least recently used entries when maxSize is exceeded', async () => {
    let storage = createMemoryFileStorage()
    let cache = createFileCache(storage, { version: 'v1', maxSize: 6 })

    await cache.set('a', new File(['aa'], 'a.txt', { type: 'text/plain' }))
    await pause()
    await cache.set('b', new File(['bb'], 'b.txt', { type: 'text/plain' }))
    await pause()
    await cache.get('a')
    await pause()
    await cache.set('c', new File(['cc'], 'c.txt', { type: 'text/plain' }))
    await pause()
    await cache.set('d', new File(['dd'], 'd.txt', { type: 'text/plain' }))

    let a = await cache.get('a')
    let b = await cache.get('b')
    let c = await cache.get('c')
    let d = await cache.get('d')

    assert.ok(a)
    assert.equal(b, null)
    assert.ok(c)
    assert.ok(d)
  })

  it('accepts LazyFile values in cache keys', async () => {
    let storage = createMemoryFileStorage()
    let cache = createFileCache(storage, { version: 'v1' })
    let lazy = new LazyFile(['content'], 'file.txt')

    let result = await cache.getOrSet(
      [lazy, 'thumbnail'],
      () => new File(['out'], 'out.txt', { type: 'text/plain' }),
    )

    assert.equal(await result.text(), 'out')
    let cached = await cache.get([lazy, 'thumbnail'])
    if (!cached) throw new Error('expected value to exist')
    assert.equal(await cached.text(), 'out')
  })

  it('includes file name in file-like key fingerprints', async () => {
    let storage = createMemoryFileStorage()
    let cache = createFileCache(storage, { version: 'v1' })
    let lastModified = Date.now()
    let count = 0

    let a = new File(['same'], 'a.txt', { type: 'text/plain', lastModified })
    let b = new File(['same'], 'b.txt', { type: 'text/plain', lastModified })

    await cache.getOrSet([a, 'thumbnail'], async () => {
      count += 1
      return new File(['first'], 'out.txt', { type: 'text/plain' })
    })
    await cache.getOrSet([b, 'thumbnail'], async () => {
      count += 1
      return new File(['second'], 'out.txt', { type: 'text/plain' })
    })

    assert.equal(count, 2)
  })

  it('includes file type in file-like key fingerprints', async () => {
    let storage = createMemoryFileStorage()
    let cache = createFileCache(storage, { version: 'v1' })
    let lastModified = Date.now()
    let count = 0

    let jpeg = new File(['same'], 'a.bin', { type: 'image/jpeg', lastModified })
    let png = new File(['same'], 'a.bin', { type: 'image/png', lastModified })

    await cache.getOrSet([jpeg, 'thumbnail'], async () => {
      count += 1
      return new File(['first'], 'out.txt', { type: 'text/plain' })
    })
    await cache.getOrSet([png, 'thumbnail'], async () => {
      count += 1
      return new File(['second'], 'out.txt', { type: 'text/plain' })
    })

    assert.equal(count, 2)
  })

  it('does not change lastModified on cache reads', async () => {
    let storage = createMemoryFileStorage()
    let cache = createFileCache(storage, { version: 'v1', maxSize: 1024 })

    let first = await cache.getOrSet(
      'etag',
      () => new File(['hello'], 'hello.txt', { type: 'text/plain' }),
    )
    let firstLastModified = first.lastModified
    await pause()

    let second = await cache.get('etag')
    if (!second) throw new Error('expected value to exist')
    let secondLastModified = second.lastModified
    await pause()

    let third = await cache.get('etag')
    if (!third) throw new Error('expected value to exist')
    let thirdLastModified = third.lastModified

    assert.equal(secondLastModified, firstLastModified)
    assert.equal(thirdLastModified, firstLastModified)
  })
})

async function pause(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 2))
}
