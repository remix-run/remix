import * as assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { parseFormData } from '@remix-run/form-data-parser'

import { R2FileStorage } from './r2-file-storage.ts'
import type { R2Bucket, R2Objects } from '@cloudflare/workers-types'

class MockR2Bucket implements Partial<R2Bucket> {
  #storage = new Map<string, { data: ArrayBuffer; metadata: any }>()

  async get(key: string) {
    let stored = this.#storage.get(key)
    if (!stored) return null

    return {
      key,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(stored.data))
          controller.close()
        }
      }),
      arrayBuffer: async () => stored.data,
      httpMetadata: stored.metadata.httpMetadata,
      customMetadata: stored.metadata.customMetadata,
      uploaded: stored.metadata.uploaded,
      size: stored.data.byteLength,
    } as any
  }

  async put(key: string, value: ArrayBuffer, options?: any) {
    this.#storage.set(key, {
      data: value,
      metadata: {
        httpMetadata: options?.httpMetadata ?? {},
        customMetadata: options?.customMetadata ?? {},
        uploaded: new Date()
      }
    })

    return {
      key,
      size: value.byteLength,
      uploaded: new Date(),
      httpMetadata: options?.httpMetadata,
      customMetadata: options?.customMetadata,
    } as any
  }

  async delete(key: string) {
    this.#storage.delete(key)
  }

  async head(key: string) {
    let stored = this.#storage.get(key)
    if (!stored) return null
    return { key, ...stored.metadata } as any
  }

  async list(options?: any) {
    let keys = Array.from(this.#storage.keys())

    if (options?.prefix) {
      keys = keys.filter(k => k.startsWith(options.prefix))
    }

    keys.sort()

    let startIndex = options?.cursor ? parseInt(options.cursor) : 0
    let limit = options?.limit ?? 1000
    let endIndex = Math.min(startIndex + limit, keys.length)

    let objects = keys.slice(startIndex, endIndex).map(key => {
      let stored = this.#storage.get(key)!
      let obj: any = {
        key,
        size: stored.data.byteLength,
        uploaded: stored.metadata.uploaded,
      }

      if (options?.include?.includes('httpMetadata')) {
        obj.httpMetadata = stored.metadata.httpMetadata
      }
      if (options?.include?.includes('customMetadata')) {
        obj.customMetadata = stored.metadata.customMetadata
      }

      return obj
    })

    return {
      objects,
      truncated: endIndex < keys.length,
      cursor: endIndex < keys.length && endIndex > startIndex ? endIndex.toString() : undefined,
      delimitedPrefixes: []
    } as R2Objects
  }
}

describe('R2FileStorage', () => {
  let mockBucket: MockR2Bucket
  let storage: R2FileStorage

  beforeEach(() => {
    mockBucket = new MockR2Bucket()
    storage = new R2FileStorage(mockBucket as unknown as R2Bucket)
  })

  it('stores and retrieves files', async () => {
    let lastModified = Date.now()
    let file = new File(['Hello, world!'], 'hello.txt', {
      type: 'text/plain',
      lastModified,
    })

    await storage.set('hello', file)

    assert.ok(await storage.has('hello'))

    let retrieved = await storage.get('hello')

    assert.ok(retrieved)
    assert.equal(retrieved.name, 'hello.txt')
    assert.equal(retrieved.type, 'text/plain')
    assert.equal(retrieved.lastModified, lastModified)
    assert.equal(retrieved.size, 13)

    let text = await retrieved.text()

    assert.equal(text, 'Hello, world!')

    await storage.remove('hello')

    assert.ok(!(await storage.has('hello')))
    assert.equal(await storage.get('hello'), null)
  })

  it('lists files with pagination', async () => {
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

  describe('integration with form-data-parser', () => {
    it('stores and lists file uploads', async () => {
      let boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
      let request = new Request('http://example.com', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="hello"; filename="hello.txt"',
          'Content-Type: text/plain',
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
      assert.equal(files[0].type, 'text/plain')
      assert.ok(files[0].lastModified)
    })
  })
})
