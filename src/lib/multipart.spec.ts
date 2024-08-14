import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readFixture } from '../test/fixtures.js';
import { createMockRequest, createMultipartMockRequest } from '../test/utils.js';
import {
  isMultipartRequest,
  parseMultipartRequest,
  MultipartParseError,
  getMultipartBoundary,
} from './multipart.js';

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
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 0);
  });

  it('parses a simple multipart form', async () => {
    let request = createMultipartMockRequest(boundary, {
      field1: 'value1',
    });

    let parts = [];
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'field1');
    assert.equal(await parts[0].text(), 'value1');
  });

  it('parses multiple parts correctly', async () => {
    let request = createMultipartMockRequest(boundary, {
      field1: 'value1',
      field2: 'value2',
    });

    let parts = [];
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part);
    }

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

    let parts = [];
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part);
    }

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

    let parts = [];
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part);
    }

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

    let parts = [];
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part);
    }

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

  it('allows buffering part contents while parsing', async () => {
    const TeslaRoadster = readFixture('Tesla-Roadster.jpg');

    let request = createMultipartMockRequest(boundary, {
      file1: {
        filename: 'tesla.jpg',
        mediaType: 'image/jpeg',
        content: TeslaRoadster,
      },
      file2: {
        filename: 'tesla.jpg',
        mediaType: 'image/jpeg',
        content: TeslaRoadster,
      },
    });

    let parts = [];
    for await (let part of parseMultipartRequest(request)) {
      parts.push({
        name: part.name,
        content: await part.bytes(),
      });
    }

    assert.equal(parts.length, 2);
  });

  it('parses large file uploads correctly', async () => {
    const TeslaRoadster = readFixture('Tesla-Roadster.jpg');

    let request = createMultipartMockRequest(boundary, {
      file1: {
        filename: 'tesla.jpg',
        mediaType: 'image/jpeg',
        content: TeslaRoadster,
      },
    });

    let parts = [];
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'file1');
    assert.equal(parts[0].filename, 'tesla.jpg');
    assert.equal(parts[0].mediaType, 'image/jpeg');
    assert.deepEqual(await parts[0].bytes(), TeslaRoadster);
  });

  it('throws when Content-Type is not multipart/form-data', async () => {
    let request = createMockRequest({
      headers: { 'Content-Type': 'text/plain' },
    });

    await assert.rejects(async () => {
      await parseMultipartRequest(request).next();
    }, MultipartParseError);
  });

  it('throws when boundary is missing', async () => {
    let request = createMockRequest({
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    await assert.rejects(async () => {
      await parseMultipartRequest(request).next();
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
      for await (let part of parseMultipartRequest(request, { maxHeaderSize: 4 * 1024 })) {
        for await (let _ of part.body) {
          // Consume all parts
        }
      }
    }, MultipartParseError);
  });

  it('throws when file exceeds maximum size', async () => {
    let request = createMockRequest({
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [
        `--${boundary}`,
        'Content-Disposition: form-data; name="field1"',
        '',
        'X'.repeat(11 * 1024 * 1024), // 11 MB file
        `--${boundary}--`,
      ].join(CRLF),
    });

    await assert.rejects(async () => {
      for await (let part of parseMultipartRequest(request, { maxFileSize: 10 * 1024 * 1024 })) {
        for await (let _ of part.body) {
          // Consume all parts
        }
      }
    }, MultipartParseError);
  });

  it('parses malformed parts', async () => {
    let request = createMockRequest({
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: [`--${boundary}`, 'Invalid-Header', '', 'Some content', `--${boundary}--`].join(CRLF),
    });

    let parts = [];
    for await (let part of parseMultipartRequest(request)) {
      parts.push(part);
    }

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
      for await (let part of parseMultipartRequest(request)) {
        for await (let _ of part.body) {
          // Consume all parts
        }
      }
    }, MultipartParseError);
  });
});
