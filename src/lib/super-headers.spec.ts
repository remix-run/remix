import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ContentDisposition } from './content-disposition.js';
import { ContentType } from './content-type.js';
import { Cookie } from './cookie.js';
import { SuperHeaders } from './super-headers.js';

describe('SuperHeaders', () => {
  it('is an instance of Headers', () => {
    let headers = new SuperHeaders();
    assert.ok(headers instanceof SuperHeaders);
    assert.ok(headers instanceof Headers);
  });

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

  it('initializes from another SuperHeaders instance', () => {
    let original = new SuperHeaders({ 'Content-Type': 'text/plain' });
    let headers = new SuperHeaders(original);
    assert.equal(headers.get('Content-Type'), 'text/plain');
  });

  it('initializes from a Headers instance', () => {
    let original = new Headers({ 'Content-Type': 'text/plain' });
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
      ['content-type', 'text/plain'],
      ['content-length', '42'],
    ]);
  });

  it('iterates over keys', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    });
    let keys = Array.from(headers.keys());
    assert.deepEqual(keys, ['content-type', 'content-length']);
  });

  it('iterates over set-cookie keys correctly', () => {
    let headers = new SuperHeaders();
    headers.append('Set-Cookie', 'session=abc');
    headers.append('Set-Cookie', 'theme=dark');
    let keys = Array.from(headers.keys());
    assert.deepEqual(keys, ['set-cookie', 'set-cookie']);
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
      ['content-type', 'text/plain'],
      ['content-length', '42'],
    ]);
  });

  it('is directly iterable', () => {
    let headers = new SuperHeaders({
      'Content-Type': 'text/plain',
      'Content-Length': '42',
    });
    let entries = Array.from(headers);
    assert.deepEqual(entries, [
      ['content-type', 'text/plain'],
      ['content-length', '42'],
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

    it('handles Content-Length header', () => {
      let headers = new SuperHeaders();
      headers.contentLength = 42;

      assert.equal(headers.contentLength, 42);
      assert.equal(headers.get('Content-Length'), '42');
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

    it('handles Set-Cookie header', () => {
      let headers = new SuperHeaders();
      headers.setCookie = ['session=abc', 'theme=dark'];

      assert.ok(Array.isArray(headers.setCookie));
      assert.equal(headers.setCookie.length, 2);
      assert.equal(headers.setCookie[0].name, 'session');
      assert.equal(headers.setCookie[0].value, 'abc');
      assert.equal(headers.setCookie[1].name, 'theme');
      assert.equal(headers.setCookie[1].value, 'dark');

      headers.setCookie = [...headers.setCookie, 'lang=en'];

      assert.equal(headers.get('Set-Cookie'), 'session=abc, theme=dark, lang=en');
    });

    it('creates empty header objects when accessed', () => {
      let headers = new SuperHeaders();

      assert.ok(headers.contentDisposition instanceof ContentDisposition);
      assert.equal(headers.contentDisposition.toString(), '');

      assert.ok(headers.contentType instanceof ContentType);
      assert.equal(headers.contentType.toString(), '');

      assert.ok(headers.cookie instanceof Cookie);
      assert.equal(headers.cookie.toString(), '');

      assert.ok(Array.isArray(headers.setCookie));
      assert.equal(headers.setCookie.length, 0);
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
