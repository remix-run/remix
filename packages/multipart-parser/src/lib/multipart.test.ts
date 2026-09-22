import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { concat, createMultipartMessage } from '../../test/utils.ts'

import {
  MultipartParseError,
  MultipartParser,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  parseMultipart,
  parseMultipartStream,
} from './multipart.ts'

const boundary = '----WebKitFormBoundaryPMcT9NSv6M3P8D4Q'
const execFileAsync = promisify(execFile)

function createChunkedIterable(body: Uint8Array, chunkSize: number): Uint8Array[] {
  let chunks: Uint8Array[] = []

  for (let i = 0; i < body.length; i += chunkSize) {
    chunks.push(body.subarray(i, i + chunkSize))
  }

  return chunks
}

function createChunkedStream(body: Uint8Array, chunkSize: number): ReadableStream<Uint8Array> {
  let chunks = createChunkedIterable(body, chunkSize)

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let chunk of chunks) {
        controller.enqueue(chunk)
      }

      controller.close()
    },
  })
}

describe('MultipartParser', () => {
  it('accepts boundaries up to 70 characters', () => {
    assert.doesNotThrow(() => new MultipartParser('b'.repeat(70)))
  })

  it('rejects boundaries longer than 70 characters', () => {
    assert.throws(
      () => new MultipartParser('b'.repeat(71)),
      (error: unknown) => {
        assert.ok(error instanceof MultipartParseError)
        assert.equal(error.message, 'Multipart boundary exceeds maximum length of 70 characters')
        return true
      },
    )
  })

  it('waits for a complete delimiter ending before yielding a part', () => {
    let parser = new MultipartParser(boundary)
    let firstChunk = new TextEncoder().encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--${boundary}`,
    )

    assert.deepEqual(Array.from(parser.write(firstChunk)), [])
    assert.deepEqual(Array.from(parser.write(new Uint8Array([13]))), [])
    let parts = Array.from(parser.write(new Uint8Array([10])))
    assert.equal(parts.length, 1)
    assert.equal(parts[0].name, 'field')
    assert.equal(parts[0].text, 'value')
  })

  it('yields the final part from write when both closing hyphens arrive', () => {
    let parser = new MultipartParser(boundary)
    let message = createMultipartMessage(boundary, { field: 'value' })

    assert.deepEqual(Array.from(parser.write(message.subarray(0, -1))), [])
    let parts = Array.from(parser.write(message.subarray(-1)))
    assert.equal(parts.length, 1)
    assert.equal(parts[0].name, 'field')
    assert.equal(parts[0].text, 'value')
    assert.equal(parser.finish(), undefined)
    assert.equal(parser.finish(), undefined)
    assert.throws(() => Array.from(parser.write(new Uint8Array([88]))), {
      name: 'MultipartParseError',
      message: 'Unexpected data after end of stream',
    })
  })

  it('does not yield the final part again when a closing CRLF arrives', () => {
    let parser = new MultipartParser(boundary)

    let parts = Array.from(parser.write(createMultipartMessage(boundary, { field: 'value' })))
    assert.equal(parts.length, 1)
    assert.equal(parts[0].text, 'value')
    assert.deepEqual(Array.from(parser.write(new Uint8Array([32, 9, 13]))), [])
    assert.deepEqual(Array.from(parser.write(new Uint8Array([10]))), [])
    assert.equal(parser.finish(), undefined)
  })

  it('rejects an invalid closing suffix after yielding the final part', () => {
    let parser = new MultipartParser(boundary)
    let parts = Array.from(parser.write(createMultipartMessage(boundary, { field: 'value' })))

    assert.equal(parts.length, 1)
    assert.equal(parts[0].text, 'value')
    assert.throws(() => Array.from(parser.write(new Uint8Array([88]))), {
      name: 'MultipartParseError',
      message: 'Invalid multipart boundary ending',
    })
  })

  it('rejects a closing CR at EOF after yielding the final part', () => {
    let parser = new MultipartParser(boundary)
    let parts = Array.from(parser.write(createMultipartMessage(boundary, { field: 'value' })))

    assert.equal(parts.length, 1)
    assert.equal(parts[0].text, 'value')
    assert.deepEqual(Array.from(parser.write(new Uint8Array([13]))), [])
    assert.throws(() => parser.finish(), {
      name: 'MultipartParseError',
      message: 'Invalid multipart boundary ending',
    })
  })

  it('finishes an empty multipart message at EOF without returning a part', () => {
    let parser = new MultipartParser(boundary)

    assert.deepEqual(Array.from(parser.write(createMultipartMessage(boundary))), [])
    assert.equal(parser.finish(), undefined)
    assert.equal(parser.finish(), undefined)
  })

  it('enforces maxParts when write yields the final part', () => {
    let parser = new MultipartParser(boundary, { maxParts: 0 })

    assert.throws(
      () => Array.from(parser.write(createMultipartMessage(boundary, { field: 'value' }))),
      MaxPartsExceededError,
    )
  })
})

describe('parseMultipart', async () => {
  it('rejects invalid closing delimiter endings at every chunk split', () => {
    for (let ending of ['X', '\r', '\rX', '\n', ' \tX']) {
      let message = concat([
        createMultipartMessage(boundary, { field: 'value' }),
        new TextEncoder().encode(ending),
      ])

      for (let split = 0; split <= message.length; split++) {
        assert.throws(
          () =>
            Array.from(
              parseMultipart([message.subarray(0, split), message.subarray(split)], {
                boundary,
              }),
            ),
          { name: 'MultipartParseError', message: 'Invalid multipart boundary ending' },
        )
      }
    }
  })

  it('accepts closing EOF, padding, and CRLF endings at every chunk split', () => {
    for (let ending of ['', ' \t', '\r\n', ' \t\r\n']) {
      let message = concat([
        createMultipartMessage(boundary, { field: 'value' }),
        new TextEncoder().encode(ending),
      ])

      for (let split = 0; split <= message.length; split++) {
        let parts = Array.from(
          parseMultipart([message.subarray(0, split), message.subarray(split)], { boundary }),
        )
        assert.deepEqual(
          parts.map((part) => [part.name, part.text]),
          [['field', 'value']],
        )
      }
    }
  })

  it('accepts empty multipart messages at every closing delimiter chunk split', () => {
    for (let ending of ['', ' \t', '\r\n', ' \t\r\n']) {
      let message = concat([createMultipartMessage(boundary), new TextEncoder().encode(ending)])

      for (let split = 0; split <= message.length; split++) {
        assert.deepEqual(
          Array.from(
            parseMultipart([message.subarray(0, split), message.subarray(split)], { boundary }),
          ),
          [],
        )
      }
    }
  })

  it('ignores an epilogue after the closing CRLF at every chunk split', () => {
    let message = concat([
      createMultipartMessage(boundary, { field: 'value' }),
      new TextEncoder().encode(' \t\r\nepilogue\r\n'),
    ])

    for (let split = 0; split <= message.length; split++) {
      let parts = Array.from(
        parseMultipart([message.subarray(0, split), message.subarray(split)], { boundary }),
      )
      assert.deepEqual(
        parts.map((part) => part.text),
        ['value'],
      )
    }
  })

  it('rejects invalid opening delimiter endings', () => {
    let message = new TextEncoder().encode(
      `--${boundary}XYContent-Disposition: form-data; name="field"\r\n\r\nvalue\r\n--${boundary}--`,
    )

    assert.throws(() => Array.from(parseMultipart(message, { boundary })), {
      name: 'MultipartParseError',
      message: 'Invalid multipart boundary ending',
    })
  })

  it('rejects invalid part delimiter endings before yielding a part', () => {
    for (let ending of ['XY', '\rX', 'X\n', '\n\n', ' \tXY', ' --']) {
      let message = createMultipartMessage(boundary, {
        field: `value\r\n--${boundary}${ending}Content-Disposition: form-data; name="other"\r\n\r\nnext`,
      })
      let parts = []

      assert.throws(
        () => {
          for (let part of parseMultipart(message, { boundary })) {
            parts.push(part)
          }
        },
        {
          name: 'MultipartParseError',
          message: 'Invalid multipart boundary ending',
        },
      )
      assert.equal(parts.length, 0)
    }
  })

  it('rejects invalid delimiter endings at every chunk split', () => {
    let message = createMultipartMessage(boundary, {
      field: `value\r\n--${boundary}XYContent-Disposition: form-data; name="other"\r\n\r\nnext`,
    })

    for (let split = 1; split < message.length; split++) {
      let chunks = [message.subarray(0, split), message.subarray(split)]
      let parts = []

      assert.throws(
        () => {
          for (let part of parseMultipart(chunks, { boundary })) {
            parts.push(part)
          }
        },
        {
          name: 'MultipartParseError',
          message: 'Invalid multipart boundary ending',
        },
      )
      assert.equal(parts.length, 0)
    }
  })

  it('parses padded delimiter lines at every chunk split', () => {
    let message = new TextEncoder().encode(
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
      let parts = Array.from(
        parseMultipart([message.subarray(0, split), message.subarray(split)], { boundary }),
      )
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

      let { parseMultipart } = await import(${JSON.stringify(moduleUrl)})
      let message = bytes([
        '--boundary',
        'Content-Disposition: form-data; name="field"',
        '',
        'value',
        '--boundary--',
        '',
      ].join('\\r\\n'))
      let parts = Array.from(parseMultipart(message, { boundary: 'boundary' }))

      if (parts.length !== 1) {
        throw new Error('expected one multipart part')
      }
      if (parts[0].size !== 5) {
        throw new Error('expected parser to read part content without encoding parser syntax')
      }

      globalThis.TextEncoder = TextEncoderConstructor
      globalThis.TextDecoder = TextDecoderConstructor

      if (parts[0].name !== 'field') {
        throw new Error('expected lazy header decoding after TextDecoder is installed')
      }
      if (parts[0].text !== 'value') {
        throw new Error('expected lazy body decoding after TextDecoder is installed')
      }
    `

    await execFileAsync(process.execPath, [
      '--disable-warning=ExperimentalWarning',
      '--input-type=module',
      '--eval',
      script,
    ])
  })

  it('ignores a textual RFC 2046 preamble before the initial boundary', () => {
    let preamble = new TextEncoder().encode('This is a MIME preamble.\r\n')
    let message = createMultipartMessage(boundary, { field: 'hello' })
    let body = new Uint8Array(preamble.length + message.length)
    body.set(preamble, 0)
    body.set(message, preamble.length)

    let parts = Array.from(parseMultipart(body, { boundary }))
    assert.equal(parts.length, 1)
    assert.equal(parts[0].text, 'hello')
  })

  it('ignores boundary text at a chunk edge in the middle of a preamble line', () => {
    let firstChunk = new TextEncoder().encode(`some preamble text x--${boundary}\r`)
    let preambleEnd = new TextEncoder().encode('\nX-Preamble: should be ignored\r\n')
    let message = createMultipartMessage(boundary, { field: 'hello' })
    let secondChunk = new Uint8Array(preambleEnd.length + message.length)
    secondChunk.set(preambleEnd, 0)
    secondChunk.set(message, preambleEnd.length)

    let parts = Array.from(parseMultipart([firstChunk, secondChunk], { boundary }))
    assert.equal(parts.length, 1)
    assert.equal(parts[0].headers['x-preamble'], undefined)
    assert.equal(parts[0].name, 'field')
    assert.equal(parts[0].text, 'hello')
  })

  it('ignores a leading CRLF before the initial boundary', () => {
    let preamble = new TextEncoder().encode('\r\n')
    let message = createMultipartMessage(boundary, { field: 'hello' })
    let body = new Uint8Array(preamble.length + message.length)
    body.set(preamble, 0)
    body.set(message, preamble.length)

    let parts = Array.from(parseMultipart(body, { boundary }))
    assert.equal(parts.length, 1)
    assert.equal(parts[0].text, 'hello')
  })

  it('finds an opening boundary split across chunks after a preamble', () => {
    let preamble = new TextEncoder().encode('This is a MIME preamble.\r\n')
    let message = createMultipartMessage(boundary, { field: 'hello' })
    let body = new Uint8Array(preamble.length + message.length)
    body.set(preamble, 0)
    body.set(message, preamble.length)

    let parts = Array.from(parseMultipart(createChunkedIterable(body, 3), { boundary }))
    assert.equal(parts.length, 1)
    assert.equal(parts[0].text, 'hello')
  })

  it('throws when the number of parts exceeds maxParts', () => {
    let message = createMultipartMessage(boundary, {
      field1: 'value1',
      field2: 'value2',
      field3: 'value3',
    })

    assert.throws(() => {
      Array.from(parseMultipart(message, { boundary, maxParts: 2 }))
    }, MaxPartsExceededError)
  })

  it('throws when aggregate content size exceeds maxTotalSize for iterable input', () => {
    let message = createMultipartMessage(boundary, {
      field1: 'hello',
      field2: 'world',
    })

    assert.throws(() => {
      Array.from(parseMultipart(createChunkedIterable(message, 7), { boundary, maxTotalSize: 9 }))
    }, MaxTotalSizeExceededError)
  })
})

describe('parseMultipartStream', async () => {
  it('rejects an invalid closing suffix after yielding the final part in single-byte chunks', async () => {
    let message = concat([
      createMultipartMessage(boundary, { field: 'value' }),
      new TextEncoder().encode('X'),
    ])
    let parts: string[] = []

    await assert.rejects(
      async () => {
        for await (let part of parseMultipartStream(createChunkedStream(message, 1), {
          boundary,
        })) {
          parts.push(part.text)
        }
      },
      { name: 'MultipartParseError', message: 'Invalid multipart boundary ending' },
    )
    assert.deepEqual(parts, ['value'])
  })

  it('yields the final part for EOF and CRLF endings in single-byte chunks', async () => {
    for (let ending of ['', ' \t', '\r\nepilogue']) {
      let message = concat([
        createMultipartMessage(boundary, { field: 'value' }),
        new TextEncoder().encode(ending),
      ])
      let parts = []
      for await (let part of parseMultipartStream(createChunkedStream(message, 1), { boundary })) {
        parts.push(part.text)
      }
      assert.deepEqual(parts, ['value'])
    }
  })

  it('rejects invalid delimiter endings in single-byte chunks', async () => {
    let message = createMultipartMessage(boundary, {
      field: `value\r\n--${boundary}XYContent-Disposition: form-data; name="other"\r\n\r\nnext`,
    })
    let parts = []

    await assert.rejects(
      async () => {
        for await (let part of parseMultipartStream(createChunkedStream(message, 1), {
          boundary,
        })) {
          parts.push(part)
        }
      },
      {
        name: 'MultipartParseError',
        message: 'Invalid multipart boundary ending',
      },
    )
    assert.equal(parts.length, 0)
  })

  it('throws when the number of parts exceeds maxParts', async () => {
    let message = createMultipartMessage(boundary, {
      field1: 'value1',
      field2: 'value2',
      field3: 'value3',
    })

    await assert.rejects(async () => {
      for await (let _ of parseMultipartStream(createChunkedStream(message, 11), {
        boundary,
        maxParts: 2,
      })) {
        // ...
      }
    }, MaxPartsExceededError)
  })

  it('throws when aggregate content size exceeds maxTotalSize', async () => {
    let message = createMultipartMessage(boundary, {
      field1: 'hello',
      field2: 'world',
    })

    await assert.rejects(async () => {
      for await (let _ of parseMultipartStream(createChunkedStream(message, 7), {
        boundary,
        maxTotalSize: 9,
      })) {
        // ...
      }
    }, MaxTotalSizeExceededError)
  })
})
