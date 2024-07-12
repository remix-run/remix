import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ContentDisposition } from './content-disposition.js';
import { ContentType } from './content-type.js';
import { Cookie } from './cookie.js';
import { SuperHeaders } from './super-headers.js';

describe('SuperHeaders', () => {
  it('initializes with no arguments', () => {
    let headers = new SuperHeaders();
    assert.equal(headers.get('content-type'), null);
  });

  it('initializes from a string', () => {
    let headers = new SuperHeaders('Content-Type: text/plain\r\nContent-Length: 42');
    assert.equal(headers.get('Content-Type'), 'text/plain');
    assert.equal(headers.get('Content-Length'), '42');
  });

  it('initializes from an object', () => {
    let headers = new SuperHeaders({ 'Content-Type': 'text/plain' });
    assert.equal(headers.get('Content-Type'), 'text/plain');
  });

  it('initializes from an array of key-value pairs', () => {
    let headers = new SuperHeaders([
      ['Content-Type', 'text/plain'],
      ['X-Custom', 'value'],
    ]);
    assert.equal(headers.get('Content-Type'), 'text/plain');
    assert.equal(headers.get('X-Custom'), 'value');
  });

  it('initializes from another Headers instance', () => {
    let original = new SuperHeaders({ 'Content-Type': 'text/plain' });
    let headers = new SuperHeaders(original);
    assert.equal(headers.get('Content-Type'), 'text/plain');
  });

  it('appends values', () => {
    let headers = new SuperHeaders();
    headers.append('X-Custom', 'value1');
    headers.append('X-Custom', 'value2');
    assert.equal(headers.get('X-Custom'), 'value1, value2');
  });

  it('sets values', () => {
    let headers = new SuperHeaders();
    headers.set('X-Custom', 'value1');
    headers.set('X-Custom', 'value2');
    assert.equal(headers.get('X-Custom'), 'value2');
  });

  it('deletes values', () => {
    let headers = new SuperHeaders({ 'X-Custom': 'value' });
    headers.delete('X-Custom');
    assert.equal(headers.has('X-Custom'), false);
  });

  it('checks if a header exists', () => {
    let headers = new SuperHeaders({ 'X-Custom': 'value' });
    assert.equal(headers.has('X-Custom'), true);
    assert.equal(headers.has('Nonexistent'), false);
  });

  it('iterates over entries', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    });
    let entries = Array.from(headers.entries());
    assert.deepEqual(entries, [
      ['Content-Type', 'text/plain'],
      ['Content-Length', '42'],
    ]);
  });

  it('iterates over names', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    });
    let keys = Array.from(headers.names());
    assert.deepEqual(keys, ['Content-Type', 'Content-Length']);
  });

  it('iterates over values', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    });
    let values = Array.from(headers.values());
    assert.deepEqual(values, ['text/plain', '42']);
  });

  it('uses forEach correctly', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    });
    let result: [string, string][] = [];
    headers.forEach((value, key) => {
      result.push([key, value]);
    });
    assert.deepEqual(result, [
      ['Content-Type', 'text/plain'],
      ['Content-Length', '42'],
    ]);
  });

  it('is directly iterable', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    });
    let entries = Array.from(headers);
    assert.deepEqual(entries, [
      ['Content-Type', 'text/plain'],
      ['Content-Length', '42'],
    ]);
  });

  describe('header-specific getters and setters', () => {
    it('handles Content-Disposition header', () => {
      let headers = new SuperHeaders();
      headers.contentDisposition = 'attachment; filename="example.txt"';

      assert.ok(headers.contentDisposition instanceof ContentDisposition);
      assert.equal(headers.contentDisposition.type, 'attachment');
      assert.equal(headers.contentDisposition.filename, 'example.txt');

      headers.contentDisposition.filename = 'new.txt';
      assert.equal(headers.get('Content-Disposition'), 'attachment; filename=new.txt');
    });

    it('handles Content-Type header', () => {
      let headers = new SuperHeaders();
      headers.contentType = 'text/plain; charset=utf-8';

      assert.ok(headers.contentType instanceof ContentType);
      assert.equal(headers.contentType.mediaType, 'text/plain');
      assert.equal(headers.contentType.charset, 'utf-8');

      headers.contentType.charset = 'iso-8859-1';
      assert.equal(headers.get('Content-Type'), 'text/plain; charset=iso-8859-1');
    });

    it('handles Cookie header', () => {
      let headers = new SuperHeaders();
      headers.cookie = 'name1=value1; name2=value2';

      assert.ok(headers.cookie instanceof Cookie);
      assert.equal(headers.cookie.get('name1'), 'value1');
      assert.equal(headers.cookie.get('name2'), 'value2');

      headers.cookie.set('name3', 'value3');
      assert.equal(headers.get('Cookie'), 'name1=value1; name2=value2; name3=value3');
    });

    it('creates empty header objects when accessed', () => {
      let headers = new SuperHeaders();

      assert.ok(headers.contentDisposition instanceof ContentDisposition);
      assert.equal(headers.contentDisposition.toString(), '');

      assert.ok(headers.contentType instanceof ContentType);
      assert.equal(headers.contentType.toString(), '');

      assert.ok(headers.cookie instanceof Cookie);
      assert.equal(headers.cookie.toString(), '');
    });
  });

  describe('toString', () => {
    it('omits empty values when stringified', () => {
      let headers = new SuperHeaders();
      headers.set('X-Test', 'value');
      headers.contentDisposition = '';
      headers.contentType = '';
      headers.cookie = '';

      let result = headers.toString();
      assert.equal(result, 'X-Test: value');
      assert.ok(!result.includes('Content-Disposition'));
      assert.ok(!result.includes('Content-Type'));
      assert.ok(!result.includes('Cookie'));
    });
  });
});
