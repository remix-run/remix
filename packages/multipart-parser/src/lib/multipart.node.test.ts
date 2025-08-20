import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getRandomBytes } from '../../test/utils.ts'
import { createMultipartRequest } from '../../test/utils.node.ts'

import type { MultipartPart } from './multipart.ts'
import { parseMultipartRequest } from './multipart.node.ts'

describe('parseMultipartRequest (node)', () => {
  let boundary = '----WebKitFormBoundaryzv5f5B2cY6tjQ0Rn'

  it('parses an empty multipart message', async () => {
    let request = createMultipartRequest(boundary)

    let parts = []
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part)
    }

    assert.equal(parts.length, 0)
  })

  it('parses a simple multipart form', async () => {
    let request = createMultipartRequest(boundary, {
      field1: 'value1',
    })

    let parts: MultipartPart[] = []
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part)
    }

    assert.equal(parts.length, 1)
    assert.equal(parts[0].name, 'field1')
    assert.equal(parts[0].text, 'value1')
  })

  it('parses large file uploads correctly', async () => {
    let maxFileSize = 1024 * 1024 * 10 // 10 MiB
    let content = getRandomBytes(maxFileSize)
    let request = createMultipartRequest(boundary, {
      file1: {
        filename: 'tesla.jpg',
        mediaType: 'image/jpeg',
        content,
      },
    })

    let parts: { name?: string; filename?: string; mediaType?: string; content: Uint8Array }[] = []
    for await (let part of parseMultipartRequest(request, { maxFileSize })) {
      parts.push({
        name: part.name,
        filename: part.filename,
        mediaType: part.mediaType,
        content: part.bytes,
      })
    }

    assert.equal(parts.length, 1)
    assert.equal(parts[0].name, 'file1')
    assert.equal(parts[0].filename, 'tesla.jpg')
    assert.equal(parts[0].mediaType, 'image/jpeg')
    assert.deepEqual(parts[0].content, content)
  })
})
