import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createMultipartMessage } from '../../test/utils.ts'

import {
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

describe('parseMultipart', async () => {
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
