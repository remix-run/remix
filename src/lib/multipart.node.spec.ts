import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readFixture } from '../test/fixtures.js';
import { createMultipartMockRequest } from '../test/utils.node.js';
import { parseMultipartRequest } from './multipart.node.js';

const TeslaRoadster = readFixture('Tesla-Roadster.jpg');

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

  it('allows buffering part contents while parsing', async () => {
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
    assert.equal(parts[0].name, 'file1');
    assert.deepEqual(parts[0].content, TeslaRoadster);
    assert.equal(parts[1].name, 'file2');
    assert.deepEqual(parts[1].content, TeslaRoadster);
  });
});
