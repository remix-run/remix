import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { concat, createMultipartMessage, getRandomBytes } from '../../test/utils.ts'

import {
  type MultipartParserOptions,
  type MultipartPart,
  MaxFileSizeExceededError,
  MaxHeaderSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  MultipartParseError,
  parseMultipartStream,
} from './multipart.ts'

const boundary = '----WebKitFormBoundaryPMcT9NSv6M3P8D4Q'
const execFileAsync = promisify(execFile)
const encoder = new TextEncoder()

function splitChunks(body: Uint8Array, chunkSize: number): Uint8Array[] {
  let chunks: Uint8Array[] = []

  for (let i = 0; i < body.length; i += chunkSize) {
    chunks.push(body.subarray(i, i + chunkSize))
  }

  return chunks
}

function createStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let chunk of chunks) {
        controller.enqueue(chunk)
      }

      controller.close()
    },
  })
}

// A source stream that hands out one chunk per pull, so tests can see how far the parser read.
function createPulledStream(chunks: Uint8Array[]): {
  stream: ReadableStream<Uint8Array>
  pulls: () => number
  canceled: () => unknown
} {
  let index = 0
  let cancelReason: unknown = undefined
  let stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(chunks[index++])
        } else {
          controller.close()
        }
      },
      cancel(reason) {
        cancelReason = reason ?? 'canceled'
      },
    },
    { highWaterMark: 0 },
  )

  return { stream, pulls: () => index, canceled: () => cancelReason }
}

interface ParsedPart {
  name: string | undefined
  filename: string | undefined
  headers: MultipartPart['headers']
  bytes: Uint8Array
  text: string
}

// Parses a message delivered in the given chunks, reading each part's content as it arrives.
// Parts read before an error are left in `parts`.
async function parseAll(
  chunks: Uint8Array[],
  options?: MultipartParserOptions & { boundary?: string },
  parts: ParsedPart[] = [],
): Promise<ParsedPart[]> {
  for await (let part of parseMultipartStream(createStream(chunks), { boundary, ...options })) {
    let bytes = await part.bytes()
    parts.push({
      name: part.name,
      filename: part.filename,
      headers: part.headers,
      bytes,
      text: new TextDecoder().decode(bytes),
    })
  }

  return parts
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  let chunks: Uint8Array<ArrayBuffer>[] = []
  let reader = stream.getReader()
  while (true) {
    let result = await reader.read()
    if (result.done) break
    chunks.push(result.value as Uint8Array<ArrayBuffer>)
  }
  return concat(chunks)
}

describe('parseMultipartStream', () => {
  it('accepts boundaries up to 70 characters', async () => {
    let longBoundary = 'b'.repeat(70)
    let parts = await parseAll([createMultipartMessage(longBoundary, { field: 'value' })], {
      boundary: longBoundary,
    })
    assert.deepEqual(
      parts.map((part) => part.text),
      ['value'],
    )
  })

  it('rejects boundaries longer than 70 characters', async () => {
    let longBoundary = 'b'.repeat(71)
    await assert.rejects(
      parseAll([createMultipartMessage(longBoundary)], { boundary: longBoundary }),
      (error: unknown) => {
        assert.ok(error instanceof MultipartParseError)
        assert.equal(error.message, 'Multipart boundary exceeds maximum length of 70 characters')
        return true
      },
    )
  })

  it('parses content correctly at any chunk size', async () => {
    let file1 = getRandomBytes(200_000)
    let message = createMultipartMessage(boundary, {
      field1: 'value1',
      file1: { filename: 'a.bin', mediaType: 'application/octet-stream', content: file1 },
      empty: { filename: 'empty.txt', mediaType: 'text/plain', content: '' },
      field2: `has a near-boundary\r\n--${boundary.slice(0, -1)} in it`,
      file2: { filename: 'b.txt', mediaType: 'text/plain', content: 'hello world' },
    })
    let expected = [
      { name: 'field1', filename: undefined, bytes: encoder.encode('value1') },
      { name: 'file1', filename: 'a.bin', bytes: file1 },
      { name: 'empty', filename: 'empty.txt', bytes: new Uint8Array() },
      {
        name: 'field2',
        filename: undefined,
        bytes: encoder.encode(`has a near-boundary\r\n--${boundary.slice(0, -1)} in it`),
      },
      { name: 'file2', filename: 'b.txt', bytes: encoder.encode('hello world') },
    ]

    for (let chunkSize of [1, 7, 4096, 65536, message.length]) {
      let parts = await parseAll(splitChunks(message, chunkSize), { maxFileSize: 1_000_000 })
      assert.deepEqual(
        parts.map(({ name, filename, bytes }) => ({ name, filename, bytes })),
        expected,
        `chunk size ${chunkSize}`,
      )
    }
  })

  it('waits for a complete delimiter ending before ending a part', async () => {
    let source = createPulledStream([
      encoder.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--${boundary}`,
      ),
      new Uint8Array([13]),
      new Uint8Array([10]),
      encoder.encode(`Content-Disposition: form-data; name="next"\r\n\r\nnext\r\n--${boundary}--`),
    ])

    let parts = parseMultipartStream(source.stream, { boundary })
    let { value: part } = await parts.next()
    assert.ok(part)
    assert.equal(part.name, 'field')
    assert.equal(await part.text(), 'value')
    assert.equal(source.pulls(), 3)

    let { value: next } = await parts.next()
    assert.ok(next)
    assert.equal(await next.text(), 'next')
    assert.equal((await parts.next()).done, true)
  })

  it('ends the final part when both closing hyphens arrive', async () => {
    let message = createMultipartMessage(boundary, { field: 'value' })
    let source = createPulledStream([message.subarray(0, -1), message.subarray(-1)])

    let parts = parseMultipartStream(source.stream, { boundary })
    let { value: part } = await parts.next()
    assert.ok(part)
    assert.equal(await part.text(), 'value')
    assert.equal(source.pulls(), 2)
    assert.equal((await parts.next()).done, true)
  })

  it('does not yield the final part again when a closing CRLF arrives', async () => {
    let parts = await parseAll([
      createMultipartMessage(boundary, { field: 'value' }),
      new Uint8Array([32, 9, 13]),
      new Uint8Array([10]),
    ])
    assert.deepEqual(
      parts.map((part) => part.text),
      ['value'],
    )
  })

  it('rejects an invalid closing suffix after reading the final part', async () => {
    let parts: ParsedPart[] = []
    await assert.rejects(
      parseAll(
        [createMultipartMessage(boundary, { field: 'value' }), new Uint8Array([88])],
        {},
        parts,
      ),
      { name: 'MultipartParseError', message: 'Invalid multipart boundary ending' },
    )
    assert.deepEqual(
      parts.map((part) => part.text),
      ['value'],
    )
  })

  it('rejects a closing CR at EOF after reading the final part', async () => {
    let parts: ParsedPart[] = []
    await assert.rejects(
      parseAll(
        [createMultipartMessage(boundary, { field: 'value' }), new Uint8Array([13])],
        {},
        parts,
      ),
      { name: 'MultipartParseError', message: 'Invalid multipart boundary ending' },
    )
    assert.deepEqual(
      parts.map((part) => part.text),
      ['value'],
    )
  })

  it('rejects an invalid closing suffix after reading the final part in single-byte chunks', async () => {
    let message = concat([
      createMultipartMessage(boundary, { field: 'value' }),
      encoder.encode('X'),
    ])
    let parts: ParsedPart[] = []

    await assert.rejects(parseAll(splitChunks(message, 1), {}, parts), {
      name: 'MultipartParseError',
      message: 'Invalid multipart boundary ending',
    })
    assert.deepEqual(
      parts.map((part) => part.text),
      ['value'],
    )
  })

  it('rejects invalid closing delimiter endings at every chunk split', async () => {
    for (let ending of ['X', '\r', '\rX', '\n', ' \tX']) {
      let message = concat([
        createMultipartMessage(boundary, { field: 'value' }),
        encoder.encode(ending),
      ])

      for (let split = 0; split <= message.length; split++) {
        await assert.rejects(parseAll([message.subarray(0, split), message.subarray(split)]), {
          name: 'MultipartParseError',
          message: 'Invalid multipart boundary ending',
        })
      }
    }
  })

  it('accepts closing EOF, padding, and CRLF endings at every chunk split', async () => {
    for (let ending of ['', ' \t', '\r\n', ' \t\r\n']) {
      let message = concat([
        createMultipartMessage(boundary, { field: 'value' }),
        encoder.encode(ending),
      ])

      for (let split = 0; split <= message.length; split++) {
        let parts = await parseAll([message.subarray(0, split), message.subarray(split)])
        assert.deepEqual(
          parts.map((part) => [part.name, part.text]),
          [['field', 'value']],
        )
      }
    }
  })

  it('reads the final part for EOF and CRLF endings in single-byte chunks', async () => {
    for (let ending of ['', ' \t', '\r\nepilogue']) {
      let message = concat([
        createMultipartMessage(boundary, { field: 'value' }),
        encoder.encode(ending),
      ])
      let parts = await parseAll(splitChunks(message, 1))
      assert.deepEqual(
        parts.map((part) => part.text),
        ['value'],
      )
    }
  })

  it('accepts empty multipart messages at every closing delimiter chunk split', async () => {
    for (let ending of ['', ' \t', '\r\n', ' \t\r\n']) {
      let message = concat([createMultipartMessage(boundary), encoder.encode(ending)])

      for (let split = 0; split <= message.length; split++) {
        assert.deepEqual(await parseAll([message.subarray(0, split), message.subarray(split)]), [])
      }
    }
  })

  it('ignores an epilogue after the closing CRLF at every chunk split', async () => {
    let message = concat([
      createMultipartMessage(boundary, { field: 'value' }),
      encoder.encode(' \t\r\nepilogue\r\n'),
    ])

    for (let split = 0; split <= message.length; split++) {
      let parts = await parseAll([message.subarray(0, split), message.subarray(split)])
      assert.deepEqual(
        parts.map((part) => part.text),
        ['value'],
      )
    }
  })

  it('rejects invalid opening delimiter endings', async () => {
    let message = encoder.encode(
      `--${boundary}XYContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--${boundary}--`,
    )

    await assert.rejects(parseAll([message]), {
      name: 'MultipartParseError',
      message: 'Invalid multipart boundary ending',
    })
  })

  it('rejects invalid part delimiter endings before a part can be read', async () => {
    for (let ending of ['XY', '\rX', 'X\n', '\n\n', ' \tXY', ' --']) {
      let message = createMultipartMessage(boundary, {
        field: `value\r\n--${boundary}${ending}Content-Disposition: form-data; name="other"\r\n\r\nnext`,
      })
      let parts: ParsedPart[] = []

      await assert.rejects(parseAll([message], {}, parts), {
        name: 'MultipartParseError',
        message: 'Invalid multipart boundary ending',
      })
      assert.equal(parts.length, 0)
    }
  })

  it('rejects invalid delimiter endings at every chunk split', async () => {
    let message = createMultipartMessage(boundary, {
      field: `value\r\n--${boundary}XYContent-Disposition: form-data; name="other"\r\n\r\nnext`,
    })

    for (let split = 1; split < message.length; split++) {
      let parts: ParsedPart[] = []

      await assert.rejects(
        parseAll([message.subarray(0, split), message.subarray(split)], {}, parts),
        { name: 'MultipartParseError', message: 'Invalid multipart boundary ending' },
      )
      assert.equal(parts.length, 0)
    }
  })

  it('rejects invalid delimiter endings in single-byte chunks', async () => {
    let message = createMultipartMessage(boundary, {
      field: `value\r\n--${boundary}XYContent-Disposition: form-data; name="other"\r\n\r\nnext`,
    })
    let parts: ParsedPart[] = []

    await assert.rejects(parseAll(splitChunks(message, 1), {}, parts), {
      name: 'MultipartParseError',
      message: 'Invalid multipart boundary ending',
    })
    assert.equal(parts.length, 0)
  })

  it('parses padded delimiter lines at every chunk split', async () => {
    let message = encoder.encode(
      [
        `--${boundary} \t`,
        'Content-Disposition: form-data; name="first"',
        '',
        'one',
        `--${boundary}\t `,
        'Content-Disposition: form-data; name="second"',
        '',
        'two',
        `--${boundary}--`,
      ].join('\r\n'),
    )

    for (let split = 1; split < message.length; split++) {
      let parts = await parseAll([message.subarray(0, split), message.subarray(split)])
      assert.deepEqual(
        parts.map((part) => [part.name, part.text]),
        [
          ['first', 'one'],
          ['second', 'two'],
        ],
      )
    }
  })

  it('does not eagerly use Web Encoding globals while importing and parsing', async () => {
    let moduleUrl = new URL('./multipart.ts', import.meta.url).href
    let script = `
      await import('@remix-run/headers/content-disposition')
      await import('@remix-run/headers/content-type')

      let TextEncoderConstructor = globalThis.TextEncoder
      let TextDecoderConstructor = globalThis.TextDecoder
      globalThis.TextEncoder = class TestTextEncoder extends TextEncoderConstructor {
        encode(input = '') {
          if (input === '\\r\\n\\r\\n' || String(input).includes('boundary')) {
            throw new Error('TextEncoder should not encode parser syntax')
          }
          return super.encode(input)
        }
      }
      globalThis.TextDecoder = class TestTextDecoder extends TextDecoderConstructor {
        constructor(label, options) {
          if (label === 'utf-8' && options?.fatal === true) {
            throw new Error('TextDecoder should be created lazily')
          }
          super(label, options)
        }
      }

      function bytes(input) {
        let result = new Uint8Array(input.length)
        for (let index = 0; index < input.length; index += 1) {
          result[index] = input.charCodeAt(index) & 0xff
        }
        return result
      }

      let { parseMultipartStream } = await import(${JSON.stringify(moduleUrl)})
      let message = bytes([
        '--boundary',
        'Content-Disposition: form-data; name="field"',
        '',
        'value',
        '--boundary--',
        '',
      ].join('\\r\\n'))
      let stream = new ReadableStream({
        start(controller) {
          controller.enqueue(message)
          controller.close()
        },
      })
      let parts = parseMultipartStream(stream, { boundary: 'boundary' })
      // The whole message is scanned here, while the Encoding globals are unusable.
      let { value: part } = await parts.next()

      if (part === undefined) {
        throw new Error('expected one multipart part')
      }

      globalThis.TextEncoder = TextEncoderConstructor
      globalThis.TextDecoder = TextDecoderConstructor

      if (part.name !== 'field') {
        throw new Error('expected lazy header decoding after TextDecoder is installed')
      }
      if ((await part.text()) !== 'value') {
        throw new Error('expected lazy body decoding after TextDecoder is installed')
      }
      if (!(await parts.next()).done) {
        throw new Error('expected one multipart part')
      }
    `

    await execFileAsync(process.execPath, [
      '--disable-warning=ExperimentalWarning',
      '--input-type=module',
      '--eval',
      script,
    ])
  })

  it('ignores a textual RFC 2046 preamble before the initial boundary', async () => {
    let body = concat([
      encoder.encode('This is a MIME preamble.\r\n'),
      createMultipartMessage(boundary, { field: 'hello' }),
    ])

    let parts = await parseAll([body])
    assert.deepEqual(
      parts.map((part) => part.text),
      ['hello'],
    )
  })

  it('ignores boundary text at a chunk edge in the middle of a preamble line', async () => {
    let firstChunk = encoder.encode(`some preamble text x--${boundary}\r`)
    let secondChunk = concat([
      encoder.encode('\nX-Preamble: should be ignored\r\n'),
      createMultipartMessage(boundary, { field: 'hello' }),
    ])

    let parts = await parseAll([firstChunk, secondChunk])
    assert.equal(parts.length, 1)
    assert.equal(parts[0].headers['x-preamble'], undefined)
    assert.equal(parts[0].name, 'field')
    assert.equal(parts[0].text, 'hello')
  })

  it('ignores a leading CRLF before the initial boundary', async () => {
    let body = concat([
      encoder.encode('\r\n'),
      createMultipartMessage(boundary, { field: 'hello' }),
    ])

    let parts = await parseAll([body])
    assert.deepEqual(
      parts.map((part) => part.text),
      ['hello'],
    )
  })

  it('finds an opening boundary split across chunks after a preamble', async () => {
    let body = concat([
      encoder.encode('This is a MIME preamble.\r\n'),
      createMultipartMessage(boundary, { field: 'hello' }),
    ])

    let parts = await parseAll(splitChunks(body, 3))
    assert.deepEqual(
      parts.map((part) => part.text),
      ['hello'],
    )
  })

  it('throws when a header exceeds maxHeaderSize', async () => {
    let message = createMultipartMessage(boundary, {
      field: { filename: 'x'.repeat(200), content: 'value' },
    })

    await assert.rejects(parseAll([message], { maxHeaderSize: 100 }), MaxHeaderSizeExceededError)
  })

  it('throws when the number of parts exceeds maxParts', async () => {
    let message = createMultipartMessage(boundary, {
      field1: 'value1',
      field2: 'value2',
      field3: 'value3',
    })

    await assert.rejects(parseAll(splitChunks(message, 11), { maxParts: 2 }), MaxPartsExceededError)
  })

  it('throws when the number of parts exceeds maxParts as soon as the extra part begins', async () => {
    let message = createMultipartMessage(boundary, { a: 'a', b: 'b', c: 'c' })

    let names: string[] = []
    await assert.rejects(async () => {
      for await (let part of parseMultipartStream(createStream(splitChunks(message, 1000)), {
        boundary,
        maxParts: 2,
      })) {
        names.push(part.name!)
      }
    }, MaxPartsExceededError)
    assert.deepEqual(names, ['a', 'b'])
  })

  it('enforces maxParts for the final part', async () => {
    let message = createMultipartMessage(boundary, { field: 'value' })

    await assert.rejects(parseAll([message], { maxParts: 0 }), MaxPartsExceededError)
  })

  it('throws when aggregate content size exceeds maxTotalSize', async () => {
    let message = createMultipartMessage(boundary, {
      field1: 'hello',
      field2: 'world',
    })

    await assert.rejects(
      parseAll(splitChunks(message, 7), { maxTotalSize: 9 }),
      MaxTotalSizeExceededError,
    )
  })

  it('errors the body and the parts iterator when a file exceeds maxFileSize', async () => {
    let message = createMultipartMessage(boundary, {
      file: { filename: 'a.bin', content: getRandomBytes(10_000) },
    })

    let bodyError: unknown
    await assert.rejects(async () => {
      for await (let part of parseMultipartStream(createStream(splitChunks(message, 1000)), {
        boundary,
        maxFileSize: 5000,
      })) {
        bodyError = await readAll(part.body).catch((error: unknown) => error)
      }
    }, MaxFileSizeExceededError)
    assert.ok(bodyError instanceof MaxFileSizeExceededError)
  })

  it('reads parts scanned before a limit error in the same chunk', async () => {
    let message = createMultipartMessage(boundary, {
      first: 'small',
      second: { filename: 'b.bin', content: getRandomBytes(10_000) },
    })

    let texts: string[] = []
    let secondError: unknown
    await assert.rejects(async () => {
      for await (let part of parseMultipartStream(createStream([message]), {
        boundary,
        maxFileSize: 5000,
      })) {
        if (part.name === 'first') {
          texts.push(await part.text())
        } else {
          secondError = await part.bytes().catch((error: unknown) => error)
        }
      }
    }, MaxFileSizeExceededError)
    assert.deepEqual(texts, ['small'])
    assert.ok(secondError instanceof MaxFileSizeExceededError)
  })

  it('errors the body when the message ends inside a part', async () => {
    let message = createMultipartMessage(boundary, { file: { filename: 'a.txt', content: 'abc' } })
    let truncated = message.subarray(0, message.length - boundary.length - 6)

    let bodyError: unknown
    await assert.rejects(
      async () => {
        for await (let part of parseMultipartStream(createStream(splitChunks(truncated, 10)), {
          boundary,
        })) {
          bodyError = await readAll(part.body).catch((error: unknown) => error)
        }
      },
      { name: 'MultipartParseError', message: 'Multipart stream not finished' },
    )
    assert.ok(bodyError instanceof MultipartParseError)
  })

  it('cancels the source stream when iteration stops early', async () => {
    let message = createMultipartMessage(boundary, { a: 'a', b: 'b' })
    let source = createPulledStream(splitChunks(message, 10))

    for await (let part of parseMultipartStream(source.stream, { boundary })) {
      assert.equal(part.name, 'a')
      break
    }

    assert.ok(source.canceled() instanceof MultipartParseError)
  })

  it('yields no parts for an empty multipart message', async () => {
    let parts = []
    for await (let part of parseMultipartStream(createStream([createMultipartMessage(boundary)]), {
      boundary,
    })) {
      parts.push(part)
    }
    assert.deepEqual(parts, [])
  })
})

describe('MultipartPart', () => {
  it('is yielded when its headers arrive, before the rest of its content', async () => {
    // Longer than the boundary, so the parser can't be holding any of it back as a partial boundary
    let first = 'first '.repeat(20)
    let second = 'second '.repeat(20)
    let source = createPulledStream([
      encoder.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\n\r\n${first}`,
      ),
      encoder.encode(second),
      encoder.encode(`\r\n--${boundary}--`),
    ])

    let parts = parseMultipartStream(source.stream, { boundary })
    let { value: part } = await parts.next()
    assert.ok(part)
    assert.equal(part.filename, 'a.txt')
    assert.equal(source.pulls(), 1)

    let reader = part.body.getReader()
    assert.deepEqual(await reader.read(), { done: false, value: encoder.encode(first) })
    assert.equal(source.pulls(), 1)
    assert.deepEqual(await reader.read(), { done: false, value: encoder.encode(second) })
    assert.equal(source.pulls(), 2)
    assert.equal((await reader.read()).done, true)
    assert.equal((await parts.next()).done, true)
  })

  it('iterates over its content with for await', async () => {
    let content = getRandomBytes(10_000)
    let message = createMultipartMessage(boundary, { file: { filename: 'a.bin', content } })

    let chunks: Uint8Array<ArrayBuffer>[] = []
    for await (let part of parseMultipartStream(createStream(splitChunks(message, 1000)), {
      boundary,
    })) {
      for await (let chunk of part) {
        chunks.push(chunk)
      }
    }

    assert.ok(chunks.length > 1)
    assert.deepEqual(concat(chunks), content)
  })

  it('decodes text split across chunks', async () => {
    let value = 'héllo wörld ✓ '.repeat(10)
    let message = createMultipartMessage(boundary, { field: value })

    let texts: string[] = []
    for await (let part of parseMultipartStream(createStream(splitChunks(message, 7)), {
      boundary,
    })) {
      texts.push(await part.text())
    }

    assert.deepEqual(texts, [value])
  })

  it('returns its content from bytes() in a buffer of its own', async () => {
    let message = createMultipartMessage(boundary, { field: 'value' })

    for await (let part of parseMultipartStream(createStream([message]), { boundary })) {
      let bytes = await part.bytes()
      assert.deepEqual(bytes, encoder.encode('value'))
      assert.equal(bytes.buffer.byteLength, bytes.length)
    }
  })

  it('discards the content of parts whose body is not read', async () => {
    let message = createMultipartMessage(boundary, {
      skipped: { filename: 'skipped.bin', content: getRandomBytes(100_000) },
      kept: 'kept value',
    })

    let parts: MultipartPart[] = []
    let texts: string[] = []
    for await (let part of parseMultipartStream(createStream(splitChunks(message, 1000)), {
      boundary,
    })) {
      parts.push(part)
      if (part.name === 'kept') texts.push(await part.text())
    }

    assert.deepEqual(
      parts.map((part) => part.name),
      ['skipped', 'kept'],
    )
    assert.deepEqual(texts, ['kept value'])
    await assert.rejects(readAll(parts[0].body), TypeError)
  })

  it('continues with the next part after its body is canceled', async () => {
    let message = createMultipartMessage(boundary, {
      canceled: { filename: 'a.bin', content: getRandomBytes(100_000) },
      next: 'next value',
    })

    let texts: string[] = []
    for await (let part of parseMultipartStream(createStream(splitChunks(message, 1000)), {
      boundary,
    })) {
      if (part.name === 'canceled') {
        let reader = part.body.getReader()
        await reader.read()
        await reader.cancel()
      } else {
        texts.push(await part.text())
      }
    }

    assert.deepEqual(texts, ['next value'])
  })

  it('waits for a body that is being read before moving to the next part', async () => {
    let content = getRandomBytes(100_000)
    let message = createMultipartMessage(boundary, {
      file: { filename: 'a.bin', content },
      next: 'next value',
    })

    let read: Promise<Uint8Array> | undefined
    let names: string[] = []
    for await (let part of parseMultipartStream(createStream(splitChunks(message, 1000)), {
      boundary,
    })) {
      names.push(part.name!)
      if (part.name === 'file') {
        // Start reading without waiting for it, like a storage write running in the background.
        read = readAll(part.body)
      } else {
        await part.text()
      }
    }

    assert.deepEqual(names, ['file', 'next'])
    assert.deepEqual(await read, content)
  })

  it('reads its content only once', async () => {
    let message = createMultipartMessage(boundary, { field: 'value' })

    for await (let part of parseMultipartStream(createStream([message]), { boundary })) {
      assert.equal(part.bodyUsed, false)
      assert.equal(await part.text(), 'value')
      assert.equal(part.bodyUsed, true)
      await assert.rejects(part.bytes(), {
        name: 'TypeError',
        message: 'Multipart part body has already been used',
      })
    }
  })
})
