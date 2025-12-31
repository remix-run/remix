import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { type LazyContent, LazyBlob, LazyFile } from './lazy-file.ts'

// Type assertions: ensure LazyBlob and LazyFile implement all native Blob/File APIs.
null as unknown as LazyBlob satisfies Record<keyof Blob, unknown>
null as unknown as LazyFile satisfies Record<keyof File, unknown>

function createLazyContent(value = ''): LazyContent {
  let buffer = new TextEncoder().encode(value)
  return {
    byteLength: buffer.byteLength,
    stream() {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(buffer)
          controller.close()
        },
      })
    },
  }
}

describe('LazyBlob', () => {
  it('has the correct size and type', () => {
    let blob = new LazyBlob(createLazyContent('X'.repeat(100)), {
      type: 'text/plain',
    })

    assert.equal(blob.size, 100)
    assert.equal(blob.type, 'text/plain')
  })

  it('is not an instance of Blob', () => {
    let blob = new LazyBlob(createLazyContent('hello'), { type: 'text/plain' })
    assert.equal(blob instanceof Blob, false)
  })

  it('has the correct Symbol.toStringTag', () => {
    let blob = new LazyBlob(createLazyContent('hello'), { type: 'text/plain' })
    assert.equal(Object.prototype.toString.call(blob), '[object LazyBlob]')
  })

  it("returns the blob's contents as a stream", async () => {
    let content = createLazyContent('hello world')
    let blob = new LazyBlob(content, { type: 'text/plain' })

    let decoder = new TextDecoder()
    let result = ''
    for await (let chunk of blob.stream()) {
      result += decoder.decode(chunk, { stream: true })
    }
    result += decoder.decode()

    assert.equal(result, 'hello world')
  })

  it("returns the blob's contents as a string", async () => {
    let content = createLazyContent('hello world')
    let blob = new LazyBlob(content, { type: 'text/plain' })

    assert.equal(await blob.text(), 'hello world')
  })

  it("returns the blob's contents as bytes", async () => {
    let content = createLazyContent('hello')
    let blob = new LazyBlob(content, { type: 'text/plain' })
    let bytes = await blob.bytes()

    assert.equal(bytes.length, 5)
    assert.deepEqual(bytes, new TextEncoder().encode('hello'))
  })

  it("returns the blob's contents as an ArrayBuffer", async () => {
    let content = createLazyContent('hello')
    let blob = new LazyBlob(content, { type: 'text/plain' })
    let buffer = await blob.arrayBuffer()

    assert.equal(buffer.byteLength, 5)
  })

  describe('toBlob()', () => {
    it('converts to a native Blob', async () => {
      let lazyBlob = new LazyBlob(createLazyContent('hello world'), { type: 'text/plain' })
      let blob = await lazyBlob.toBlob()

      assert.equal(blob instanceof Blob, true)
      assert.equal(blob.size, 11)
      assert.equal(blob.type, 'text/plain')
      assert.equal(await blob.text(), 'hello world')
    })
  })

  describe('slice()', () => {
    it('returns a LazyBlob with the correct size', () => {
      let blob = new LazyBlob(createLazyContent('hello world'), { type: 'text/plain' })
      let slice = blob.slice(0, 5)
      assert.equal(slice instanceof LazyBlob, true)
      assert.equal(slice.size, 5)
    })
  })

  describe('toString()', () => {
    it('throws a TypeError to prevent misuse with Response', () => {
      let blob = new LazyBlob(createLazyContent('hello'), { type: 'text/plain' })
      assert.throws(() => blob.toString(), {
        name: 'TypeError',
        message:
          'Cannot convert LazyBlob to string. Use .stream() to get a ReadableStream for Response and other streaming APIs, or .toBlob() for non-streaming APIs that require a complete Blob (e.g. FormData). Always prefer .stream() when possible.',
      })
    })
  })
})

describe('LazyFile', () => {
  it('has the correct name, size, type, and lastModified timestamp', () => {
    let now = Date.now()
    let lazyFile = new LazyFile(createLazyContent('X'.repeat(100)), 'example.txt', {
      type: 'text/plain',
      lastModified: now,
    })

    assert.equal(lazyFile.name, 'example.txt')
    assert.equal(lazyFile.size, 100)
    assert.equal(lazyFile.type, 'text/plain')
    assert.equal(lazyFile.lastModified, now)
  })

  it('is not an instance of File', () => {
    let lazyFile = new LazyFile(createLazyContent('hello'), 'hello.txt', { type: 'text/plain' })
    assert.equal(lazyFile instanceof File, false)
  })

  it('has the correct Symbol.toStringTag', () => {
    let lazyFile = new LazyFile(createLazyContent('hello'), 'hello.txt', { type: 'text/plain' })
    assert.equal(Object.prototype.toString.call(lazyFile), '[object LazyFile]')
  })

  it('can be initialized with a [Blob] as the content', async () => {
    let content = [new Blob(['hello world'], { type: 'text/plain' })]
    let lazyFile = new LazyFile(content, 'hello.txt', { type: 'text/plain' })
    assert.equal(lazyFile.size, 11)
    assert.equal('hello world', await lazyFile.text())
  })

  it('can be initialized with another LazyFile as the content', async () => {
    let content = [new LazyFile(['hello world'], 'hello.txt', { type: 'text/plain' })]
    let lazyFile = new LazyFile(content, 'hello.txt', { type: 'text/plain' })
    assert.equal(lazyFile.size, 11)
    assert.equal('hello world', await lazyFile.text())
  })

  it('can be initialized with multiple Blobs and strings as the content and can slice them correctly', async () => {
    let parts = [
      new Blob(['  hello '], { type: 'text/plain' }),
      'world',
      new Blob(['!', '  '], { type: 'text/plain' }),
      'extra stuff',
    ]
    let lazyFile = new LazyFile(parts, 'hello.txt', { type: 'text/plain' })
    assert.equal(lazyFile.size, 27)
    assert.equal(await lazyFile.slice(2, -13).text(), 'hello world!')
  })

  it("returns the file's contents as a stream", async () => {
    let content = createLazyContent('hello world')
    let lazyFile = new LazyFile(content, 'hello.txt', { type: 'text/plain' })

    let decoder = new TextDecoder()
    let result = ''
    for await (let chunk of lazyFile.stream()) {
      result += decoder.decode(chunk, { stream: true })
    }
    result += decoder.decode()

    assert.equal(result, 'hello world')
  })

  it("returns the file's contents as a string", async () => {
    let content = createLazyContent('hello world')
    let lazyFile = new LazyFile(content, 'hello.txt', {
      type: 'text/plain',
    })

    assert.equal(await lazyFile.text(), 'hello world')
  })

  describe('toFile()', () => {
    it('converts to a native File', async () => {
      let now = Date.now()
      let lazyFile = new LazyFile(createLazyContent('hello world'), 'hello.txt', {
        type: 'text/plain',
        lastModified: now,
      })
      let file = await lazyFile.toFile()

      assert.equal(file instanceof File, true)
      assert.equal(file.name, 'hello.txt')
      assert.equal(file.size, 11)
      assert.equal(file.type, 'text/plain')
      assert.equal(file.lastModified, now)
      assert.equal(await file.text(), 'hello world')
    })
  })

  describe('toBlob()', () => {
    it('converts to a native Blob', async () => {
      let lazyFile = new LazyFile(createLazyContent('hello world'), 'hello.txt', {
        type: 'text/plain',
      })
      let blob = await lazyFile.toBlob()

      assert.equal(blob instanceof Blob, true)
      assert.equal(blob.size, 11)
      assert.equal(blob.type, 'text/plain')
      assert.equal(await blob.text(), 'hello world')
    })
  })

  describe('slice()', () => {
    it('returns a LazyBlob with the same size as the original when slicing from 0 to the end', () => {
      let lazyFile = new LazyFile(createLazyContent('hello world'), 'hello.txt', {
        type: 'text/plain',
      })
      let slice = lazyFile.slice(0)
      assert.equal(slice instanceof LazyBlob, true)
      assert.equal(slice.size, lazyFile.size)
    })

    it('returns a LazyBlob with size 0 when the "start" index is greater than the content length', () => {
      let lazyFile = new LazyFile(['hello world'], 'hello.txt', {
        type: 'text/plain',
      })
      let slice = lazyFile.slice(100)
      assert.equal(slice.size, 0)
    })

    it('returns a LazyBlob with size 0 when the "start" index is greater than the "end" index', () => {
      let lazyFile = new LazyFile(['hello world'], 'hello.txt', {
        type: 'text/plain',
      })
      let slice = lazyFile.slice(5, 0)
      assert.equal(slice.size, 0)
    })

    it('calls content.stream() with the correct range', (t) => {
      let content = createLazyContent('X'.repeat(100))
      let read = t.mock.method(content, 'stream')
      let lazyFile = new LazyFile(content, 'example.txt', { type: 'text/plain' })
      lazyFile.slice(10, 20).stream()
      assert.equal(read.mock.calls.length, 1)
      assert.deepEqual(read.mock.calls[0].arguments, [10, 20])
    })

    it('calls content.stream() with the correct range when slicing a file with a negative "start" index', (t) => {
      let content = createLazyContent('X'.repeat(100))
      let read = t.mock.method(content, 'stream')
      let lazyFile = new LazyFile(content, 'example.txt', { type: 'text/plain' })
      lazyFile.slice(-10).stream()
      assert.equal(read.mock.calls.length, 1)
      assert.deepEqual(read.mock.calls[0].arguments, [90, 100])
    })

    it('calls content.stream() with the correct range when slicing a file with a negative "end" index', (t) => {
      let content = createLazyContent('X'.repeat(100))
      let read = t.mock.method(content, 'stream')
      let lazyFile = new LazyFile(content, 'example.txt', { type: 'text/plain' })
      lazyFile.slice(0, -10).stream()
      assert.equal(read.mock.calls.length, 1)
      assert.deepEqual(read.mock.calls[0].arguments, [0, 90])
    })

    it('calls content.stream() with the correct range when slicing a file with negative "start" and "end" indexes', (t) => {
      let content = createLazyContent('X'.repeat(100))
      let read = t.mock.method(content, 'stream')
      let lazyFile = new LazyFile(content, 'example.txt', { type: 'text/plain' })
      lazyFile.slice(-20, -10).stream()
      assert.equal(read.mock.calls.length, 1)
      assert.deepEqual(read.mock.calls[0].arguments, [80, 90])
    })

    it('calls content.stream() with the correct range when slicing a file with a "start" index greater than the "end" index', (t) => {
      let content = createLazyContent('X'.repeat(100))
      let read = t.mock.method(content, 'stream')
      let lazyFile = new LazyFile(content, 'example.txt', { type: 'text/plain' })
      lazyFile.slice(20, 10).stream()
      assert.equal(read.mock.calls.length, 1)
      assert.deepEqual(read.mock.calls[0].arguments, [20, 20])
    })
  })

  describe('toString()', () => {
    it('throws a TypeError to prevent misuse with Response', () => {
      let lazyFile = new LazyFile(createLazyContent('hello'), 'hello.txt', { type: 'text/plain' })
      assert.throws(() => lazyFile.toString(), {
        name: 'TypeError',
        message:
          'Cannot convert LazyFile to string. Use .stream() to get a ReadableStream for Response and other streaming APIs, or .toFile()/.toBlob() for non-streaming APIs that require a complete File/Blob (e.g. FormData). Always prefer .stream() when possible.',
      })
    })
  })
})
