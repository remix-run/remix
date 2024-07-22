import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ContentDisposition, ContentType, SuperHeaders } from 'fetch-super-headers';

import { MultipartParseError, parseMultipartFormData } from './multipart.js';

const CRLF = '\r\n';

function* generateChunks(content: string, chunkSize = 16 * 1024): Generator<Uint8Array> {
  let encoder = new TextEncoder();
  for (let i = 0; i < content.length; i += chunkSize) {
    yield encoder.encode(content.slice(i, i + chunkSize));
  }
}

function createReadableStream(content: string, chunkSize?: number): ReadableStream<Uint8Array> {
  // @ts-expect-error ReadableStream.from is not yet in the DOM types
  return ReadableStream.from(generateChunks(content, chunkSize));
}

function createMockRequest({
  headers,
  body = '',
}: {
  headers?: Headers | HeadersInit;
  body?: string | ReadableStream<Uint8Array>;
}): Request {
  return {
    headers: headers instanceof Headers ? headers : new Headers(headers),
    body: typeof body === 'string' ? createReadableStream(body) : body,
  } as unknown as Request;
}

type PartValue =
  | string
  | {
      filename?: string;
      filenameSplat?: string;
      mediaType?: string;
      content: string;
    };

function createMultipartBody(boundary: string, parts: { [name: string]: PartValue }): string {
  let lines = [];

  for (let [name, part] of Object.entries(parts)) {
    lines.push(`--${boundary}`);

    if (typeof part === 'string') {
      let contentDisposition = new ContentDisposition();
      contentDisposition.type = 'form-data';
      contentDisposition.name = name;
      lines.push(`Content-Disposition: ${contentDisposition}`);
      lines.push('');
      lines.push(part);
    } else {
      let contentDisposition = new ContentDisposition();
      contentDisposition.type = 'form-data';
      contentDisposition.name = name;
      contentDisposition.filename = part.filename;
      contentDisposition.filenameSplat = part.filenameSplat;

      lines.push(`Content-Disposition: ${contentDisposition}`);

      if (part.mediaType) {
        let contentType = new ContentType();
        contentType.mediaType = part.mediaType;

        lines.push(`Content-Type: ${contentType}`);
      }

      lines.push('');
      lines.push(part.content);
    }
  }

  lines.push(`--${boundary}--`);

  return lines.join(CRLF);
}

function createMultipartMockRequest(
  boundary: string,
  parts: { [name: string]: PartValue }
): Request {
  let headers = new SuperHeaders();
  headers.contentType.mediaType = 'multipart/form-data';
  headers.contentType.boundary = boundary;

  let body = createMultipartBody(boundary, parts);

  return createMockRequest({ headers, body });
}

describe('parseMultipartFormData', async () => {
  let boundary = 'boundary123';

  it('parses a simple multipart form', async () => {
    let request = createMultipartMockRequest(boundary, {
      field1: 'value1',
    });

    let parts = [];
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'field1');
    assert.equal(parts[0].text, 'value1');
  });

  it('parses multiple parts correctly', async () => {
    let request = createMultipartMockRequest(boundary, {
      field1: 'value1',
      field2: 'value2',
    });

    let parts = [];
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 2);
    assert.equal(parts[0].name, 'field1');
    assert.equal(parts[0].text, 'value1');
    assert.equal(parts[1].name, 'field2');
    assert.equal(parts[1].text, 'value2');
  });

  it('parses empty parts correctly', async () => {
    let request = createMultipartMockRequest(boundary, {
      empty: '',
    });

    let parts = [];
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'empty');
    assert.equal(parts[0].content.byteLength, 0);
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
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'file1');
    assert.equal(parts[0].filename, 'test.txt');
    assert.equal(parts[0].mediaType, 'text/plain');
    assert.equal(parts[0].text, 'File content');
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
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 3);
    assert.equal(parts[0].name, 'field1');
    assert.equal(parts[0].text, 'value1');
    assert.equal(parts[1].name, 'field2');
    assert.equal(parts[1].text, 'value2');
    assert.equal(parts[2].name, 'file1');
    assert.equal(parts[2].filename, 'test.txt');
    assert.equal(parts[2].mediaType, 'text/plain');
    assert.equal(parts[2].text, 'File content');
  });

  it('throws when Content-Type is not multipart/form-data', async () => {
    let request = createMockRequest({
      headers: { 'Content-Type': 'text/plain' },
    });

    await assert.rejects(async () => {
      await parseMultipartFormData(request).next();
    }, MultipartParseError);
  });

  it('throws when boundary is missing', async () => {
    let request = createMockRequest({
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    await assert.rejects(async () => {
      await parseMultipartFormData(request).next();
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
        'X-Large-Header: ' + 'a'.repeat(1024 * 1024), // 1MB header
        '',
        'value1',
        `--${boundary}--`,
      ].join(CRLF),
    });

    await assert.rejects(async () => {
      await parseMultipartFormData(request, { maxHeaderSize: 1024 }).next();
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
        'a'.repeat(1024 * 1024 * 11), // 11MB content
        `--${boundary}--`,
      ].join(CRLF),
    });

    await assert.rejects(async () => {
      await parseMultipartFormData(request, { maxFileSize: 1024 * 1024 * 10 }).next();
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
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].headers.get('Invalid-Header'), null);
    assert.equal(parts[0].text, 'Some content');
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
      for await (let part of parseMultipartFormData(request)) {
        // Consume all parts
      }
    }, MultipartParseError);
  });
});
