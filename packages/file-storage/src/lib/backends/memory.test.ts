import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseFormData } from '@remix-run/form-data-parser'

import { createMemoryFileStorage } from './memory.ts'

describe('createMemoryFileStorage', () => {
  it('stores and retrieves files', async () => {
    let storage = createMemoryFileStorage()
    let file = new File(['Hello, world!'], 'hello.txt', { type: 'text/plain' })

    await storage.set('hello', file)

    assert.ok(storage.has('hello'))

    let retrieved = await storage.get('hello')

    assert.ok(retrieved)
    assert.equal(retrieved!.name, 'hello.txt')
    assert.equal(retrieved!.type, 'text/plain')
    assert.equal(retrieved!.size, 13)

    let text = await retrieved.text()

    assert.equal(text, 'Hello, world!')

    storage.remove('hello')

    assert.ok(!storage.has('hello'))
    assert.equal(storage.get('hello'), null)
  })

  it('lists files with pagination', async () => {
    let storage = createMemoryFileStorage()
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
    let storage = createMemoryFileStorage()
    let allKeys = ['a', 'b', 'b/c', 'c', 'd']

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    )

    let { cursor, files } = await storage.list({ prefix: 'b' })

    assert.equal(cursor, undefined)
    assert.equal(files.length, 2)
    assert.equal(files[0].key, 'b')
    assert.equal(files[1].key, 'b/c')
  })

  it('lists files with metadata', async () => {
    let storage = createMemoryFileStorage()
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
      let storage = createMemoryFileStorage()

      let boundary = '----WebKitFormBoundaryzv5f5B8XUeVl7e0A'
      let request = new Request('http://example.com', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="a"; filename="hello.txt"',
          'Content-Type: text/plain',
          '',
          'Hello, world!',
          `--${boundary}--`,
        ].join('\r\n'),
      })

      await parseFormData(request, async (file) => {
        await storage.put('hello', file)
      })

      assert.ok(storage.has('hello'))

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
