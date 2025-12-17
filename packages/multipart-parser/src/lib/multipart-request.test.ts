import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createMultipartMessage, getRandomBytes } from '../../test/utils.ts'

import type { MultipartPart } from './multipart.ts'
import {
  MultipartParseError,
  MaxHeaderSizeExceededError,
  MaxFileSizeExceededError,
} from './multipart.ts'
import {
  getMultipartBoundary,
  isMultipartRequest,
  parseMultipartRequest,
} from './multipart-request.ts'

const CRLF = '\r\n'

describe('getMultipartBoundary', async () => {
  it('returns the boundary from the Content-Type header', async () => {
    assert.equal(getMultipartBoundary('multipart/form-data; boundary=boundary123'), 'boundary123')
  })

  it('returns null when boundary is missing', async () => {
    assert.equal(getMultipartBoundary('multipart/form-data'), null)
  })

  it('returns null when Content-Type header is not multipart', async () => {
    assert.equal(getMultipartBoundary('text/plain'), null)
  })
})

describe('isMultipartRequest', async () => {
  it('returns true for multipart/form-data requests', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    assert.ok(isMultipartRequest(request))
  })

  it('returns true for multipart/mixed requests', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/mixed',
      },
    })

    assert.ok(isMultipartRequest(request))
  })

  it('returns false for other content types', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
    })

    assert.ok(!isMultipartRequest(request))
  })
})

describe('parseMultipartRequest', async () => {
  let boundary = '----WebKitFormBoundaryz8Zv2UxQ7f4a0Z3H'

  it('parses an empty multipart message', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: `--${boundary}--`,
    })

    let parts = []
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part)
    }

    assert.equal(parts.length, 0)
  })

  it('parses a simple multipart form', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: createMultipartMessage(boundary, {
        field1: 'value1',
      }),
    })

    let parts: MultipartPart[] = []
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part)
    }

    assert.equal(parts.length, 1)
    assert.equal(parts[0].name, 'field1')
    assert.equal(parts[0].text, 'value1')
  })

  it('parses multiple parts correctly', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: createMultipartMessage(boundary, {
        field1: 'value1',
        field2: 'value2',
      }),
    })

    let parts: MultipartPart[] = []
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part)
    }

    assert.equal(parts.length, 2)
    assert.equal(parts[0].name, 'field1')
    assert.equal(parts[0].text, 'value1')
    assert.equal(parts[1].name, 'field2')
    assert.equal(parts[1].text, 'value2')
  })

  it('parses empty parts correctly', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: createMultipartMessage(boundary, {
        empty: '',
      }),
    })

    let parts: MultipartPart[] = []
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part)
    }

    assert.equal(parts.length, 1)
    assert.equal(parts[0].name, 'empty')
    assert.equal(parts[0].bytes.byteLength, 0)
  })

  it('parses file uploads correctly', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: createMultipartMessage(boundary, {
        file1: {
          filename: 'test.txt',
          mediaType: 'text/plain',
          content: 'File content',
        },
      }),
    })

    let parts: MultipartPart[] = []
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part)
    }

    assert.equal(parts.length, 1)
    assert.equal(parts[0].name, 'file1')
    assert.equal(parts[0].filename, 'test.txt')
    assert.equal(parts[0].mediaType, 'text/plain')
    assert.equal(parts[0].text, 'File content')
  })

  it('parses multiple fields and a file upload', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: createMultipartMessage(boundary, {
        field1: 'value1',
        field2: 'value2',
        file1: {
          filename: 'test.txt',
          mediaType: 'text/plain',
          content: 'File content',
        },
      }),
    })

    let parts: MultipartPart[] = []
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part)
    }

    assert.equal(parts.length, 3)
    assert.equal(parts[0].name, 'field1')
    assert.equal(parts[0].text, 'value1')
    assert.equal(parts[1].name, 'field2')
    assert.equal(parts[1].text, 'value2')
    assert.equal(parts[2].name, 'file1')
    assert.equal(parts[2].filename, 'test.txt')
    assert.equal(parts[2].mediaType, 'text/plain')
    assert.equal(parts[2].text, 'File content')
  })

  it('parses large file uploads correctly', async () => {
    let maxFileSize = 10 * 1024 * 1024 // 10 MiB
    let content = getRandomBytes(maxFileSize) // 10 MiB file
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: createMultipartMessage(boundary, {
        file1: {
          filename: 'random.dat',
          mediaType: 'application/octet-stream',
          content,
        },
      }),
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
    assert.equal(parts[0].filename, 'random.dat')
    assert.equal(parts[0].mediaType, 'application/octet-stream')
    assert.deepEqual(parts[0].content, content)
  })

  it('throws when Content-Type is not multipart/form-data', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
    })

    await assert.rejects(async () => {
      for await (let _ of parseMultipartRequest(request)) {
        // ...
      }
    }, MultipartParseError)
  })

  it('throws when initial boundary is missing', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: 'Content-Disposition: form-data; name="field1"\r\n\r\nvalue1',
    })

    await assert.rejects(async () => {
      for await (let _ of parseMultipartRequest(request)) {
        // ...
      }
    }, MultipartParseError)
  })

  it('throws when header exceeds maximum size', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="field1"',
        'X-Large-Header: ' + 'X'.repeat(6 * 1024), // 6 KB header
        '',
        'value1',
        `--${boundary}--`,
      ].join(CRLF),
    })

    await assert.rejects(async () => {
      for await (let _ of parseMultipartRequest(request, { maxHeaderSize: 4 * 1024 })) {
        // ...
      }
    }, MaxHeaderSizeExceededError)
  })

  it('throws when a file exceeds maximum size', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: createMultipartMessage(boundary, {
        file1: {
          filename: 'random.dat',
          mediaType: 'application/octet-stream',
          content: getRandomBytes(11 * 1024 * 1024), // 11 MB file
        },
      }),
    })

    await assert.rejects(async () => {
      for await (let _ of parseMultipartRequest(request, { maxFileSize: 10 * 1024 * 1024 })) {
        // ...
      }
    }, MaxFileSizeExceededError)
  })

  it('parses malformed parts', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [`--${boundary}`, 'Invalid-Header', '', 'Some content', `--${boundary}--`].join(CRLF),
    })

    let parts: MultipartPart[] = []
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part)
    }

    assert.equal(parts.length, 1)
    assert.equal(parts[0].headers.get('Invalid-Header'), null)
    assert.equal(parts[0].text, 'Some content')
  })

  it('throws error when final boundary is missing', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="field1"',
        '',
        'value1',
        `--${boundary}`,
      ].join(CRLF),
    })

    await assert.rejects(async () => {
      for await (let _ of parseMultipartRequest(request)) {
        // ...
      }
    }, MultipartParseError)
  })

  it('throws error when request body is empty', async () => {
    let request = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: null,
    })

    await assert.rejects(async () => {
      for await (let _ of parseMultipartRequest(request)) {
        // ...
      }
    }, MultipartParseError)
  })
})
