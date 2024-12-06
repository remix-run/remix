import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getRandomBytes } from '../../test/utils.ts';
import { createMultipartMockRequest } from '../../test/utils.node.ts';

import { parseMultipartRequest } from './multipart.node.ts';

describe('parseMultipartRequest (node)', () => {
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

  it('parses large file uploads correctly', async () => {
    let content = getRandomBytes(1024 * 1024 * 10); // 10 MB file
    let request = createMultipartMockRequest(boundary, {
      file1: {
        filename: 'tesla.jpg',
        mediaType: 'image/jpeg',
        content,
      },
    });

    let parts = [];
    for await (let part of parseMultipartRequest(request)) {
      parts.push({
        name: part.name,
        filename: part.filename,
        mediaType: part.mediaType,
        content: await part.bytes(),
      });
    }

    assert.equal(parts.length, 1);
    assert.equal(parts[0].name, 'file1');
    assert.equal(parts[0].filename, 'tesla.jpg');
    assert.equal(parts[0].mediaType, 'image/jpeg');
    assert.deepEqual(parts[0].content, content);
  });
});
