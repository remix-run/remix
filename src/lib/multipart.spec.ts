import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MultipartParseError, parseMultipartFormData } from './multipart.js';

const CRLF = '\r\n';

function createReadableStreamFromString(
  content: string,
  chunkSize = 1024 * 16 // 16 KB is default on node servers
): ReadableStream<Uint8Array> {
  let encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      let offset = 0;

      function pushChunk() {
        if (offset < content.length) {
          let chunk = content.slice(offset, offset + chunkSize);
          controller.enqueue(encoder.encode(chunk));
          offset += chunkSize;
          setTimeout(pushChunk, 0);
        } else {
          controller.close();
        }
      }

      pushChunk();
    },
  });
}

function createMockRequest(
  body: string,
  headers: { [key: string]: string },
  chunkSize?: number
): Request {
  return {
    headers: new Headers(headers),
    body: createReadableStreamFromString(body, chunkSize),
  } as unknown as Request;
}

describe('parseMultipartFormData', async () => {
  let boundary = 'boundary123';

  it('Successfully parses a simple multipart form', async () => {
    let body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="field1"',
      '',
      'value1',
      `--${boundary}--`,
    ].join(CRLF);
    let request = createMockRequest(body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    let parts = [];
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'field1');
    assert.equal(new TextDecoder().decode(parts[0].content), 'value1');
  });

  it('Handles multiple parts correctly', async () => {
    let body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="field1"',
      '',
      'value1',
      `--${boundary}`,
      'Content-Disposition: form-data; name="field2"',
      '',
      'value2',
      `--${boundary}--`,
    ].join(CRLF);
    let request = createMockRequest(body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    let parts = [];
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 2);
    assert.equal(parts[0].name, 'field1');
    assert.equal(new TextDecoder().decode(parts[0].content), 'value1');
    assert.equal(parts[1].name, 'field2');
    assert.equal(new TextDecoder().decode(parts[1].content), 'value2');
  });

  it('Handles file uploads correctly', async () => {
    let body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file1"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      'File content here',
      `--${boundary}--`,
    ].join(CRLF);
    let request = createMockRequest(body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    let parts = [];
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'file1');
    assert.equal(parts[0].filename, 'test.txt');
    assert.equal(parts[0].contentType, 'text/plain');
    assert.equal(new TextDecoder().decode(parts[0].content), 'File content here');
  });

  it('Handles multiple fields and a file upload', async () => {
    let body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="field1"',
      '',
      'value1',
      `--${boundary}`,
      'Content-Disposition: form-data; name="field2"',
      '',
      'value2',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file1"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      'File content here',
      `--${boundary}--`,
    ].join(CRLF);
    let request = createMockRequest(body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    let parts = [];
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 3);
    assert.equal(parts[0].name, 'field1');
    assert.equal(new TextDecoder().decode(parts[0].content), 'value1');
    assert.equal(parts[1].name, 'field2');
    assert.equal(new TextDecoder().decode(parts[1].content), 'value2');
    assert.equal(parts[2].name, 'file1');
    assert.equal(parts[2].filename, 'test.txt');
    assert.equal(parts[2].contentType, 'text/plain');
    assert.equal(new TextDecoder().decode(parts[2].content), 'File content here');
  });

  it('Throws error when Content-Type is not multipart/form-data', async () => {
    let body = 'Some body';
    let request = createMockRequest(body, { 'Content-Type': 'text/plain' });

    await assert.rejects(async () => {
      await parseMultipartFormData(request).next();
    }, MultipartParseError);
  });

  it('Throws error when boundary is missing', async () => {
    let body = 'Some body';
    let request = createMockRequest(body, { 'Content-Type': 'multipart/form-data' });

    await assert.rejects(async () => {
      await parseMultipartFormData(request).next();
    }, MultipartParseError);
  });

  it('Throws error when headers exceed maximum size', async () => {
    let largeHeader = 'X-Large-Header: ' + 'a'.repeat(1024 * 1024); // 1MB header
    let body = [
      `--${boundary}`,
      largeHeader,
      'Content-Disposition: form-data; name="field1"',
      '',
      'value1',
      `--${boundary}--`,
    ].join(CRLF);
    let request = createMockRequest(
      body,
      {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      1024 * 256
    );

    await assert.rejects(async () => {
      await parseMultipartFormData(request, { maxHeaderSize: 1024 }).next();
    }, MultipartParseError);
  });

  it('Throws error when part exceeds maximum size', async () => {
    let largeContent = 'a'.repeat(1024 * 1024 * 11); // 11MB content
    let body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="field1"',
      '',
      largeContent,
      `--${boundary}--`,
    ].join(CRLF);
    let request = createMockRequest(
      body,
      {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      1024 * 1024
    );

    await assert.rejects(async () => {
      await parseMultipartFormData(request, { maxPartSize: 1024 * 1024 * 10 }).next();
    }, MultipartParseError);
  });

  it('Handles malformed messages', async () => {
    let body = [`--${boundary}`, 'Invalid-Header', '', 'Some content', `--${boundary}--`].join(
      CRLF
    );
    let request = createMockRequest(body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    let parts = [];
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].headers.get('Invalid-Header'), null);
    assert.equal(new TextDecoder().decode(parts[0].content), 'Some content');
  });

  it('Throws error when final boundary is missing', async () => {
    let body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="field1"',
      '',
      'value1',
      `--${boundary}`,
    ].join(CRLF);
    let request = createMockRequest(body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    await assert.rejects(async () => {
      for await (let part of parseMultipartFormData(request)) {
        // Consume all parts
      }
    }, MultipartParseError);
  });

  it('Handles empty parts correctly', async () => {
    let body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="empty"',
      '',
      '',
      `--${boundary}--`,
    ].join(CRLF);
    let request = createMockRequest(body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    let parts = [];
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'empty');
    assert.equal(parts[0].content.byteLength, 0);
  });

  it('Parses complex Content-Disposition correctly', async () => {
    let body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="name with spaces.txt"; filename*=utf-8\'\'encoded%20filename.txt',
      '',
      'content',
      `--${boundary}--`,
    ].join(CRLF);
    let request = createMockRequest(body, {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    });

    let parts = [];
    for await (let part of parseMultipartFormData(request)) {
      parts.push(part);
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'file');
    assert.equal(parts[0].filename, 'encoded filename.txt');
    assert.equal(parts[0].contentDisposition.filename, 'name with spaces.txt');
    assert.equal(parts[0].contentDisposition.filenameSplat, "utf-8''encoded%20filename.txt");
  });
});
