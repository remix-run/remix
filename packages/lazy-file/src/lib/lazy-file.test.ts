import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { type LazyContent, LazyFile } from './lazy-file.ts'

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

describe('LazyFile', () => {
  it('has the correct name, size, type, and lastModified timestamp', () => {
    let now = Date.now()
    let file = new LazyFile(createLazyContent('X'.repeat(100)), 'example.txt', {
      type: 'text/plain',
      lastModified: now,
    })

    assert.equal(file.name, 'example.txt')
    assert.equal(file.size, 100)
    assert.equal(file.type, 'text/plain')
    assert.equal(file.lastModified, now)
  })

  it('can be initialized with a [Blob] as the content', async () => {
    let content = [new Blob(['hello world'], { type: 'text/plain' })]
    let file = new LazyFile(content, 'hello.txt', { type: 'text/plain' })
    assert.equal(file.size, 11)
    assert.equal('hello world', await file.text())
  })

  it('can be initialized with another LazyFile as the content', async () => {
    let content = [new LazyFile(['hello world'], 'hello.txt', { type: 'text/plain' })]
    let file = new LazyFile(content, 'hello.txt', { type: 'text/plain' })
    assert.equal(file.size, 11)
    assert.equal('hello world', await file.text())
  })

  it('can be initialized with multiple Blobs and strings as the content and can slice them correctly', async () => {
    let parts = [
      new Blob(['  hello '], { type: 'text/plain' }),
      'world',
      new Blob(['!', '  '], { type: 'text/plain' }),
      'extra stuff',
    ]
    let file = new LazyFile(parts, 'hello.txt', { type: 'text/plain' })
    assert.equal(file.size, 27)
    assert.equal(await file.slice(2, -13).text(), 'hello world!')
  })

  it("returns the file's contents as a stream", async () => {
    let content = createLazyContent('hello world')
    let file = new LazyFile(content, 'hello.txt', { type: 'text/plain' })

    let decoder = new TextDecoder()
    let result = ''
    for await (let chunk of file.stream()) {
      result += decoder.decode(chunk, { stream: true })
    }
    result += decoder.decode()

    assert.equal(result, 'hello world')
  })

  it("returns the file's contents as a string", async () => {
    let content = createLazyContent('hello world')
    let file = new LazyFile(content, 'hello.txt', {
      type: 'text/plain',
    })

    assert.equal(await file.text(), 'hello world')
  })

  describe('slice()', () => {
    it('returns a file with the same size as the original when slicing from 0 to the end', () => {
      let file = new LazyFile(createLazyContent('hello world'), 'hello.txt', {
        type: 'text/plain',
      })
      let slice = file.slice(0)
      assert.equal(slice.size, file.size)
    })

    it('returns a file with size 0 when the "start" index is greater than the content length', () => {
      let file = new LazyFile(['hello world'], 'hello.txt', {
        type: 'text/plain',
      })
      let slice = file.slice(100)
      assert.equal(slice.size, 0)
    })

    it('returns a file with size 0 when the "start" index is greater than the "end" index', () => {
      let file = new LazyFile(['hello world'], 'hello.txt', {
        type: 'text/plain',
      })
      let slice = file.slice(5, 0)
      assert.equal(slice.size, 0)
    })

    it('calls content.stream() with the correct range', (t) => {
      let content = createLazyContent('X'.repeat(100))
      let read = t.mock.method(content, 'stream')
      let file = new LazyFile(content, 'example.txt', { type: 'text/plain' })
      file.slice(10, 20).stream()
      assert.equal(read.mock.calls.length, 1)
      assert.deepEqual(read.mock.calls[0].arguments, [10, 20])
    })

    it('calls content.stream() with the correct range when slicing a file with a negative "start" index', (t) => {
      let content = createLazyContent('X'.repeat(100))
      let read = t.mock.method(content, 'stream')
      let file = new LazyFile(content, 'example.txt', { type: 'text/plain' })
      file.slice(-10).stream()
      assert.equal(read.mock.calls.length, 1)
      assert.deepEqual(read.mock.calls[0].arguments, [90, 100])
    })

    it('calls content.stream() with the correct range when slicing a file with a negative "end" index', (t) => {
      let content = createLazyContent('X'.repeat(100))
      let read = t.mock.method(content, 'stream')
      let file = new LazyFile(content, 'example.txt', { type: 'text/plain' })
      file.slice(0, -10).stream()
      assert.equal(read.mock.calls.length, 1)
      assert.deepEqual(read.mock.calls[0].arguments, [0, 90])
    })

    it('calls content.stream() with the correct range when slicing a file with negative "start" and "end" indexes', (t) => {
      let content = createLazyContent('X'.repeat(100))
      let read = t.mock.method(content, 'stream')
      let file = new LazyFile(content, 'example.txt', { type: 'text/plain' })
      file.slice(-20, -10).stream()
      assert.equal(read.mock.calls.length, 1)
      assert.deepEqual(read.mock.calls[0].arguments, [80, 90])
    })

    it('calls content.stream() with the correct range when slicing a file with a "start" index greater than the "end" index', (t) => {
      let content = createLazyContent('X'.repeat(100))
      let read = t.mock.method(content, 'stream')
      let file = new LazyFile(content, 'example.txt', { type: 'text/plain' })
      file.slice(20, 10).stream()
      assert.equal(read.mock.calls.length, 1)
      assert.deepEqual(read.mock.calls[0].arguments, [20, 20])
    })
  })
})
