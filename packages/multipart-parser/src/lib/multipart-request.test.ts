import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMockRequest, createMultipartMockRequest, getRandomBytes } from '../../test/utils.ts';

import {
  MultipartParseError,
  MaxHeaderSizeExceededError,
  MaxFileSizeExceededError,
  type MultipartPart,
} from './multipart.ts';
import {
  getMultipartBoundary,
  isMultipartRequest,
  parseMultipartRequest,
} from './multipart-request.ts';

const CRLF = '\r\n';

describe('getMultipartBoundary', async () => {
  it('returns the boundary from the Content-Type header', async () => {
    assert.equal(getMultipartBoundary('multipart/form-data; boundary=boundary123'), 'boundary123');
  });

  it('returns null when boundary is missing', async () => {
    assert.equal(getMultipartBoundary('multipart/form-data'), null);
  });

  it('returns null when Content-Type header is not multipart', async () => {
    assert.equal(getMultipartBoundary('text/plain'), null);
  });
});

describe('isMultipartRequest', async () => {
  it('returns true for multipart/form-data requests', async () => {
    let request = createMockRequest({
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    assert.ok(isMultipartRequest(request));
  });

  it('returns true for multipart/mixed requests', async () => {
    let request = createMockRequest({
      headers: { 'Content-Type': 'multipart/mixed' },
    });

    assert.ok(isMultipartRequest(request));
  });

  it('returns false for other content types', async () => {
    let request = createMockRequest({
      headers: { 'Content-Type': 'text/plain' },
    });

    assert.ok(!isMultipartRequest(request));
  });
});

describe('parseMultipartRequest', async () => {
  let boundary = 'boundary123';

  it('parses an empty multipart message', async () => {
    let request = createMultipartMockRequest(boundary);

    let parts = [];
    await parseMultipartRequest(request, (part) => {
      parts.push(part);
    });

    assert.equal(parts.length, 0);
  });

  it('parses a simple multipart form', async () => {
    let request = createMultipartMockRequest(boundary, {
      field1: 'value1',
    });

    let parts: MultipartPart[] = [];
    await parseMultipartRequest(request, (part) => {
      parts.push(part);
    });

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'field1');
    assert.equal(await parts[0].text(), 'value1');
  });

  it('parses multiple parts correctly', async () => {
    let request = createMultipartMockRequest(boundary, {
      field1: 'value1',
      field2: 'value2',
    });

    let parts: MultipartPart[] = [];
    await parseMultipartRequest(request, (part) => {
      parts.push(part);
    });

    assert.equal(parts.length, 2);
    assert.equal(parts[0].name, 'field1');
    assert.equal(await parts[0].text(), 'value1');
    assert.equal(parts[1].name, 'field2');
    assert.equal(await parts[1].text(), 'value2');
  });

  it('parses empty parts correctly', async () => {
    let request = createMultipartMockRequest(boundary, {
      empty: '',
    });

    let parts: MultipartPart[] = [];
    await parseMultipartRequest(request, (part) => {
      parts.push(part);
    });

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'empty');
    assert.equal((await parts[0].bytes()).byteLength, 0);
  });

  it('parses file uploads correctly', async () => {
    let request = createMultipartMockRequest(boundary, {
      file1: {
        filename: 'test.txt',
        mediaType: 'text/plain',
        content: 'File content',
      },
    });

    let parts: MultipartPart[] = [];
    await parseMultipartRequest(request, (part) => {
      parts.push(part);
    });

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'file1');
    assert.equal(parts[0].filename, 'test.txt');
    assert.equal(parts[0].mediaType, 'text/plain');
    assert.equal(await parts[0].text(), 'File content');
  });

  it('parses multiple fields and a file upload', async () => {
    let request = createMultipartMockRequest(boundary, {
      field1: 'value1',
      field2: 'value2',
      file1: {
        filename: 'test.txt',
        mediaType: 'text/plain',
        content: 'File content',
      },
    });

    let parts: MultipartPart[] = [];
    await parseMultipartRequest(request, (part) => {
      parts.push(part);
    });

    assert.equal(parts.length, 3);
    assert.equal(parts[0].name, 'field1');
    assert.equal(await parts[0].text(), 'value1');
    assert.equal(parts[1].name, 'field2');
    assert.equal(await parts[1].text(), 'value2');
    assert.equal(parts[2].name, 'file1');
    assert.equal(parts[2].filename, 'test.txt');
    assert.equal(parts[2].mediaType, 'text/plain');
    assert.equal(await parts[2].text(), 'File content');
  });

  it('parses large file uploads correctly', async () => {
    let content = getRandomBytes(10 * 1024 * 1024); // 10 MB file
    let request = createMultipartMockRequest(boundary, {
      file1: {
        filename: 'random.dat',
        mediaType: 'application/octet-stream',
        content,
      },
    });

    let parts: { name?: string; filename?: string; mediaType?: string; content: Uint8Array }[] = [];
    await parseMultipartRequest(request, async (part) => {
      parts.push({
        name: part.name,
        filename: part.filename,
        mediaType: part.mediaType,
        content: await part.bytes(),
      });
    });

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'file1');
    assert.equal(parts[0].filename, 'random.dat');
    assert.equal(parts[0].mediaType, 'application/octet-stream');
    assert.deepEqual(parts[0].content, content);
  });

  it('throws when Content-Type is not multipart/form-data', async () => {
    let request = createMockRequest({
      headers: { 'Content-Type': 'text/plain' },
    });

    await assert.rejects(async () => {
      await parseMultipartRequest(request, () => {});
    }, MultipartParseError);
  });

  it('throws when boundary is missing', async () => {
    let request = createMockRequest({
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    await assert.rejects(async () => {
      await parseMultipartRequest(request, () => {});
    }, MultipartParseError);
  });

  it('throws when header exceeds maximum size', async () => {
    let request = createMockRequest({
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
    });

    await assert.rejects(async () => {
      await parseMultipartRequest(request, { maxHeaderSize: 4 * 1024 }, () => {});
    }, MaxHeaderSizeExceededError);
  });

  it('throws when a file exceeds maximum size', async () => {
    let request = createMultipartMockRequest(boundary, {
      file1: {
        filename: 'random.dat',
        mediaType: 'application/octet-stream',
        content: getRandomBytes(11 * 1024 * 1024), // 11 MB file
      },
    });

    await assert.rejects(async () => {
      await parseMultipartRequest(request, { maxFileSize: 10 * 1024 * 1024 }, () => {});
    }, MaxFileSizeExceededError);
  });

  it('errors the stream when a file exceeds maximum size', async () => {
    let request = createMultipartMockRequest(boundary, {
      file1: {
        filename: 'random.dat',
        mediaType: 'application/octet-stream',
        content: getRandomBytes(11 * 1024 * 1024), // 11 MB file
      },
    });

    let parts: MultipartPart[] = [];
    try {
      await parseMultipartRequest(request, { maxFileSize: 10 * 1024 * 1024 }, (part) => {
        parts.push(part);
      });
    } catch (error) {
      // Ignore the parse error.
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'file1');
    assert.equal(parts[0].filename, 'random.dat');
    assert.equal(parts[0].mediaType, 'application/octet-stream');

    await assert.rejects(async () => {
      await parts[0].bytes();
    }, MaxFileSizeExceededError);
  });

  it('parses malformed parts', async () => {
    let request = createMockRequest({
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [`--${boundary}`, 'Invalid-Header', '', 'Some content', `--${boundary}--`].join(CRLF),
    });

    let parts: MultipartPart[] = [];
    await parseMultipartRequest(request, (part) => {
      parts.push(part);
    });

    assert.equal(parts.length, 1);
    assert.equal(parts[0].headers.get('Invalid-Header'), null);
    assert.equal(await parts[0].text(), 'Some content');
  });

  it('throws error when final boundary is missing', async () => {
    let request = createMockRequest({
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
    });

    await assert.rejects(async () => {
      await parseMultipartRequest(request, () => {});
    }, MultipartParseError);
  });
});
