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
