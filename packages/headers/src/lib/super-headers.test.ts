import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AcceptLanguage } from './accept-language.ts';
import { CacheControl } from './cache-control.ts';
import { ContentDisposition } from './content-disposition.ts';
import { ContentType } from './content-type.ts';
import { Cookie } from './cookie.ts';
import { SuperHeaders } from './super-headers.ts';

describe('SuperHeaders', () => {
  it('is an instance of Headers', () => {
    let headers = new SuperHeaders();
    assert.ok(headers instanceof SuperHeaders);
    assert.ok(headers instanceof Headers);
  });

  it('initializes with no arguments', () => {
    let headers = new SuperHeaders();
    assert.equal(headers.get('Content-Type'), null);
  });

  it('initializes from a string', () => {
    let headers = new SuperHeaders('Content-Type: text/plain\r\nContent-Length: 42');
    assert.equal(headers.get('Content-Type'), 'text/plain');
    assert.equal(headers.get('Content-Length'), '42');
  });

  it('initializes from an object of header name/value pairs', () => {
    let headers = new SuperHeaders({ 'Content-Type': 'text/plain' });
    assert.equal(headers.get('Content-Type'), 'text/plain');
  });

  it('initializes from an object of property name/value pairs', () => {
    let headers = new SuperHeaders({ contentType: 'text/plain' });
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

  it('initializes with a AcceptLanguageInit', () => {
    let headers = new SuperHeaders({
      acceptLanguage: { 'en-US': 1, en: 0.9 },
    });
    assert.equal(headers.get('Accept-Language'), 'en-US,en;q=0.9');
  });

  it('initializes with a CacheControlInit', () => {
    let headers = new SuperHeaders({ cacheControl: 'public, max-age=3600' });
    assert.equal(headers.get('Cache-Control'), 'public, max-age=3600');
  });

  it('initializes with a ContentDispositionInit', () => {
    let headers = new SuperHeaders({
      contentDisposition: { type: 'attachment', filename: 'example.txt' },
    });
    assert.equal(headers.get('Content-Disposition'), 'attachment; filename=example.txt');
  });

  it('initializes with a ContentTypeInit', () => {
    let headers = new SuperHeaders({ contentType: { mediaType: 'text/plain', charset: 'utf-8' } });
    assert.equal(headers.get('Content-Type'), 'text/plain; charset=utf-8');
  });

  it('initializes with a CookieInit', () => {
    let headers = new SuperHeaders({ cookie: [['name', 'value']] });
    assert.equal(headers.get('Cookie'), 'name=value');
  });

  it('initializes with a SetCookieInit', () => {
    let headers = new SuperHeaders({
      setCookie: [
        { name: 'session', value: 'abc', path: '/' },
        { name: 'theme', value: 'dark', expires: new Date('2021-12-31T23:59:59Z') },
      ],
    });
    assert.deepEqual(headers.getSetCookie(), [
      'session=abc; Path=/',
      'theme=dark; Expires=Fri, 31 Dec 2021 23:59:59 GMT',
    ]);
  });

  it('initializes with a lastModified Date', () => {
    let headers = new SuperHeaders({ lastModified: new Date('2021-01-01T00:00:00Z') });
    assert.equal(headers.get('Last-Modified'), 'Fri, 01 Jan 2021 00:00:00 GMT');
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

  describe('setting values in the constructor', () => {
    it('handles the Accept-Language header', () => {
      let headers = new SuperHeaders({ acceptLanguage: 'en-US,en;q=0.9' });
      assert.equal(headers.get('Accept-Language'), 'en-US,en;q=0.9');
    });

    it('handles the Age header', () => {
      let headers = new SuperHeaders({ age: 42 });
      assert.equal(headers.get('Age'), '42');
    });

    it('handles the Cache-Control header', () => {
      let headers = new SuperHeaders({ cacheControl: 'public, max-age=3600' });
      assert.equal(headers.get('Cache-Control'), 'public, max-age=3600');
    });

    it('handles the Content-Disposition header', () => {
      let headers = new SuperHeaders({ contentDisposition: 'attachment; filename="example.txt"' });
      assert.equal(headers.get('Content-Disposition'), 'attachment; filename="example.txt"');
    });

    it('handles the Content-Length header', () => {
      let headers = new SuperHeaders({ contentLength: 42 });
      assert.equal(headers.get('Content-Length'), '42');
    });

    it('handles the Content-Type header', () => {
      let headers = new SuperHeaders({ contentType: 'text/plain; charset=utf-8' });
      assert.equal(headers.get('Content-Type'), 'text/plain; charset=utf-8');
    });

    it('handles the Cookie header', () => {
      let headers = new SuperHeaders({ cookie: 'name1=value1; name2=value2' });
      assert.equal(headers.get('Cookie'), 'name1=value1; name2=value2');
    });

    it('handles the Expires header', () => {
      let headers = new SuperHeaders({ expires: new Date('2021-01-01T00:00:00Z') });
      assert.equal(headers.get('Expires'), 'Fri, 01 Jan 2021 00:00:00 GMT');
    });

    it('handles the Last-Modified header', () => {
      let headers = new SuperHeaders({ lastModified: new Date('2021-01-01T00:00:00Z') });
      assert.equal(headers.get('Last-Modified'), 'Fri, 01 Jan 2021 00:00:00 GMT');
    });

    it('handles the Set-Cookie header', () => {
      let headers = new SuperHeaders({ setCookie: ['session=abc', 'theme=dark'] });
      assert.deepEqual(headers.getSetCookie(), ['session=abc', 'theme=dark']);
    });

    it('handles the Set-Cookie header with objects', () => {
      let headers = new SuperHeaders({
        setCookie: [
          { name: 'session', value: 'abc' },
          { name: 'theme', value: 'dark' },
        ],
      });
      assert.deepEqual(headers.getSetCookie(), ['session=abc', 'theme=dark']);
    });

    it('handles the Set-Cookie header with options', () => {
      let headers = new SuperHeaders({
        setCookie: [
          { name: 'session', value: 'abc', path: '/' },
          { name: 'theme', value: 'dark', expires: new Date('2021-12-31T23:59:59Z') },
        ],
      });
      assert.deepEqual(headers.getSetCookie(), [
        'session=abc; Path=/',
        'theme=dark; Expires=Fri, 31 Dec 2021 23:59:59 GMT',
      ]);
    });
  });

  describe('get() and set()', () => {
    it('handles the Accept-Language header', () => {
      let headers = new SuperHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      assert.equal(headers.get('Accept-Language'), 'en-US,en;q=0.9');

      headers.set('Accept-Language', 'en;q=0.8, fr');
      assert.equal(headers.get('Accept-Language'), 'en;q=0.8, fr');

      headers.set('Accept-Language', '');
      assert.equal(headers.get('Accept-Language'), '');

      headers.delete('Accept-Language');
      assert.equal(headers.get('Accept-Language'), null);
    });

    it('handles the Age header', () => {
      let headers = new SuperHeaders({ Age: '42' });
      assert.equal(headers.get('Age'), '42');

      headers.set('Age', '100');
      assert.equal(headers.get('Age'), '100');

      headers.set('Age', '');
      assert.equal(headers.get('Age'), '');

      headers.delete('Age');
      assert.equal(headers.get('Age'), null);
    });

    it('handles the Cache-Control header', () => {
      let headers = new SuperHeaders({ 'Cache-Control': 'public, max-age=3600' });
      assert.equal(headers.get('Cache-Control'), 'public, max-age=3600');

      headers.set('Cache-Control', 'no-cache');
      assert.equal(headers.get('Cache-Control'), 'no-cache');

      headers.set('Cache-Control', '');
      assert.equal(headers.get('Cache-Control'), '');

      headers.delete('Cache-Control');
      assert.equal(headers.get('Cache-Control'), null);
    });

    it('handles the Content-Disposition header', () => {
      let headers = new SuperHeaders({
        'Content-Disposition': 'attachment; filename="example.txt"',
      });
      assert.equal(headers.get('Content-Disposition'), 'attachment; filename="example.txt"');

      headers.set('Content-Disposition', 'inline');
      assert.equal(headers.get('Content-Disposition'), 'inline');

      headers.set('Content-Disposition', '');
      assert.equal(headers.get('Content-Disposition'), '');

      headers.delete('Content-Disposition');
      assert.equal(headers.get('Content-Disposition'), null);
    });

    it('handles the Content-Length header', () => {
      let headers = new SuperHeaders({ 'Content-Length': '42' });
      assert.equal(headers.get('Content-Length'), '42');

      headers.set('Content-Length', '100');
      assert.equal(headers.get('Content-Length'), '100');

      headers.set('Content-Length', '');
      assert.equal(headers.get('Content-Length'), '');

      headers.delete('Content-Length');
      assert.equal(headers.get('Content-Length'), null);
    });

    it('handles the Content-Type header', () => {
      let headers = new SuperHeaders({ 'Content-Type': 'text/plain; charset=utf-8' });
      assert.equal(headers.get('Content-Type'), 'text/plain; charset=utf-8');

      headers.set('Content-Type', 'text/html');
      assert.equal(headers.get('Content-Type'), 'text/html');

      headers.set('Content-Type', '');
      assert.equal(headers.get('Content-Type'), '');

      headers.delete('Content-Type');
      assert.equal(headers.get('Content-Type'), null);
    });

    it('handles the Cookie header', () => {
      let headers = new SuperHeaders({ Cookie: 'name1=value1; name2=value2' });
      assert.equal(headers.get('Cookie'), 'name1=value1; name2=value2');

      headers.set('Cookie', 'name3=value3');
      assert.equal(headers.get('Cookie'), 'name3=value3');

      headers.set('Cookie', '');
      assert.equal(headers.get('Cookie'), '');

      headers.delete('Cookie');
      assert.equal(headers.get('Cookie'), null);
    });

    it('handles the Date header', () => {
      let headers = new SuperHeaders({ Date: 'Fri, 01 Jan 2021 00:00:00 GMT' });
      assert.equal(headers.get('Date'), 'Fri, 01 Jan 2021 00:00:00 GMT');

      headers.set('Date', 'Fri, 31 Dec 2021 23:59:59 GMT');
      assert.equal(headers.get('Date'), 'Fri, 31 Dec 2021 23:59:59 GMT');

      headers.set('Date', '');
      assert.equal(headers.get('Date'), '');

      headers.delete('Date');
      assert.equal(headers.get('Date'), null);
    });

    it('handles the Expires header', () => {
      let headers = new SuperHeaders({ Expires: 'Fri, 01 Jan 2021 00:00:00 GMT' });
      assert.equal(headers.get('Expires'), 'Fri, 01 Jan 2021 00:00:00 GMT');

      headers.set('Expires', 'Fri, 31 Dec 2021 23:59:59 GMT');
      assert.equal(headers.get('Expires'), 'Fri, 31 Dec 2021 23:59:59 GMT');

      headers.set('Expires', '');
      assert.equal(headers.get('Expires'), '');

      headers.delete('Expires');
      assert.equal(headers.get('Expires'), null);
    });

    it('handles the Last-Modified header', () => {
      let headers = new SuperHeaders({ 'Last-Modified': 'Fri, 01 Jan 2021 00:00:00 GMT' });
      assert.equal(headers.get('Last-Modified'), 'Fri, 01 Jan 2021 00:00:00 GMT');

      headers.set('Last-Modified', 'Fri, 31 Dec 2021 23:59:59 GMT');
      assert.equal(headers.get('Last-Modified'), 'Fri, 31 Dec 2021 23:59:59 GMT');

      headers.set('Last-Modified', '');
      assert.equal(headers.get('Last-Modified'), '');

      headers.delete('Last-Modified');
      assert.equal(headers.get('Last-Modified'), null);
    });

    it('handles the If-Modified-Since header', () => {
      let headers = new SuperHeaders({ 'If-Modified-Since': 'Fri, 01 Jan 2021 00:00:00 GMT' });
      assert.equal(headers.get('If-Modified-Since'), 'Fri, 01 Jan 2021 00:00:00 GMT');

      headers.set('If-Modified-Since', 'Fri, 31 Dec 2021 23:59:59 GMT');
      assert.equal(headers.get('If-Modified-Since'), 'Fri, 31 Dec 2021 23:59:59 GMT');

      headers.set('If-Modified-Since', '');
      assert.equal(headers.get('If-Modified-Since'), '');

      headers.delete('If-Modified-Since');
      assert.equal(headers.get('If-Modified-Since'), null);
    });

    it('handles the If-Unmodified-Since header', () => {
      let headers = new SuperHeaders({ 'If-Unmodified-Since': 'Fri, 01 Jan 2021 00:00:00 GMT' });
      assert.equal(headers.get('If-Unmodified-Since'), 'Fri, 01 Jan 2021 00:00:00 GMT');

      headers.set('If-Unmodified-Since', 'Fri, 31 Dec 2021 23:59:59 GMT');
      assert.equal(headers.get('If-Unmodified-Since'), 'Fri, 31 Dec 2021 23:59:59 GMT');

      headers.set('If-Unmodified-Since', '');
      assert.equal(headers.get('If-Unmodified-Since'), '');

      headers.delete('If-Unmodified-Since');
      assert.equal(headers.get('If-Unmodified-Since'), null);
    });

    it('handles the Set-Cookie header', () => {
      let headers = new SuperHeaders({ 'Set-Cookie': 'session=abc' });
      assert.deepEqual(headers.getSetCookie(), ['session=abc']);

      headers.set('Set-Cookie', 'theme=dark');
      assert.deepEqual(headers.getSetCookie(), ['theme=dark']);

      headers.set('Set-Cookie', '');
      assert.deepEqual(headers.getSetCookie(), ['']);

      headers.delete('Set-Cookie');
      assert.deepEqual(headers.getSetCookie(), []);
    });
  });

  describe('header-specific getters and setters', () => {
    it('handles Accept-Language header', () => {
      let headers = new SuperHeaders();

      assert.ok(headers.acceptLanguage instanceof AcceptLanguage);

      headers.acceptLanguage = 'en-US,en;q=0.9';
      assert.deepEqual(headers.acceptLanguage.size, 2);
      assert.deepEqual(headers.acceptLanguage.languages, ['en-US', 'en']);
      assert.deepEqual(headers.acceptLanguage.qualities, [1, 0.9]);

      headers.acceptLanguage = { en: 1, 'en-US': 0.8 };
      assert.deepEqual(headers.acceptLanguage.size, 2);
      assert.deepEqual(headers.acceptLanguage.languages, ['en', 'en-US']);
      assert.deepEqual(headers.acceptLanguage.qualities, [1, 0.8]);

      headers.acceptLanguage = null;
      assert.ok(headers.acceptLanguage instanceof AcceptLanguage);
      assert.equal(headers.acceptLanguage.toString(), '');
    });

    it('handles Age header', () => {
      let headers = new SuperHeaders();

      assert.equal(headers.age, null);

      headers.age = '42';
      assert.equal(headers.age, 42);

      headers.age = 42;
      assert.equal(headers.age, 42);

      headers.age = null;
      assert.equal(headers.age, null);
    });

    it('handles Cache-Control header', () => {
      let headers = new SuperHeaders();

      assert.ok(headers.cacheControl instanceof CacheControl);

      headers.cacheControl = 'public, max-age=3600';
      assert.equal(headers.cacheControl.public, true);
      assert.equal(headers.cacheControl.maxAge, 3600);

      headers.cacheControl.maxAge = 1800;
      assert.equal(headers.cacheControl.maxAge, 1800);

      headers.cacheControl = { noCache: true, noStore: true };
      assert.equal(headers.cacheControl.noCache, true);
      assert.equal(headers.cacheControl.noStore, true);

      headers.cacheControl = null;
      assert.ok(headers.cacheControl instanceof CacheControl);
      assert.equal(headers.cacheControl.toString(), '');
    });

    it('handles Content-Disposition header', () => {
      let headers = new SuperHeaders();

      assert.ok(headers.contentDisposition instanceof ContentDisposition);

      headers.contentDisposition = 'attachment; filename="example.txt"';
      assert.equal(headers.contentDisposition.type, 'attachment');
      assert.equal(headers.contentDisposition.filename, 'example.txt');

      headers.contentDisposition.filename = 'new.txt';
      assert.equal(headers.contentDisposition.filename, 'new.txt');

      headers.contentDisposition = { type: 'inline', filename: 'index.html' };
      assert.equal(headers.contentDisposition.type, 'inline');
      assert.equal(headers.contentDisposition.filename, 'index.html');

      headers.contentDisposition = null;
      assert.ok(headers.contentDisposition instanceof ContentDisposition);
      assert.equal(headers.contentDisposition.toString(), '');
    });

    it('handles Content-Length header', () => {
      let headers = new SuperHeaders();

      assert.equal(headers.contentLength, null);

      headers.contentLength = '42';
      assert.equal(headers.contentLength, 42);

      headers.contentLength = 42;
      assert.equal(headers.contentLength, 42);

      headers.contentLength = null;
      assert.equal(headers.contentLength, null);
    });

    it('handles Content-Type header', () => {
      let headers = new SuperHeaders();

      assert.ok(headers.contentType instanceof ContentType);

      headers.contentType = 'text/plain; charset=utf-8';
      assert.equal(headers.contentType.mediaType, 'text/plain');
      assert.equal(headers.contentType.charset, 'utf-8');

      headers.contentType.charset = 'iso-8859-1';
      assert.equal(headers.contentType.charset, 'iso-8859-1');

      headers.contentType = { mediaType: 'text/html' };
      assert.equal(headers.contentType.mediaType, 'text/html');

      headers.contentType = null;
      assert.ok(headers.contentType instanceof ContentType);
      assert.equal(headers.contentType.toString(), '');
    });

    it('handles Cookie header', () => {
      let headers = new SuperHeaders();

      assert.ok(headers.cookie instanceof Cookie);

      headers.cookie = 'name1=value1; name2=value2';
      assert.equal(headers.cookie.get('name1'), 'value1');
      assert.equal(headers.cookie.get('name2'), 'value2');

      headers.cookie.set('name3', 'value3');
      assert.equal(headers.cookie.get('name3'), 'value3');

      headers.cookie = [['name4', 'value4']];
      assert.equal(headers.cookie.get('name4'), 'value4');

      headers.cookie = null;
      assert.ok(headers.cookie instanceof Cookie);
      assert.equal(headers.cookie.toString(), '');
    });

    it('handles Date header', () => {
      let headers = new SuperHeaders();

      assert.equal(headers.date, null);

      headers.date = new Date('2021-01-01T00:00:00Z');
      assert.ok(headers.date instanceof Date);
      assert.equal(headers.date.toUTCString(), 'Fri, 01 Jan 2021 00:00:00 GMT');

      headers.date = null;
      assert.equal(headers.date, null);
    });

    it('handles Expires header', () => {
      let headers = new SuperHeaders();

      assert.equal(headers.expires, null);

      headers.expires = new Date('2021-01-01T00:00:00Z');
      assert.ok(headers.expires instanceof Date);
      assert.equal(headers.expires.toUTCString(), 'Fri, 01 Jan 2021 00:00:00 GMT');

      headers.expires = null;
      assert.equal(headers.expires, null);
    });

    it('handles Last-Modified header', () => {
      let headers = new SuperHeaders();

      assert.equal(headers.lastModified, null);

      headers.lastModified = new Date('2021-01-01T00:00:00Z');
      assert.ok(headers.lastModified instanceof Date);
      assert.equal(headers.lastModified.toUTCString(), 'Fri, 01 Jan 2021 00:00:00 GMT');

      headers.lastModified = null;
      assert.equal(headers.lastModified, null);
    });

    it('handles If-Modified-Since header', () => {
      let headers = new SuperHeaders();

      assert.equal(headers.ifModifiedSince, null);

      headers.ifModifiedSince = new Date('2021-01-01T00:00:00Z');
      assert.ok(headers.ifModifiedSince instanceof Date);
      assert.equal(headers.ifModifiedSince.toUTCString(), 'Fri, 01 Jan 2021 00:00:00 GMT');

      headers.ifModifiedSince = null;
      assert.equal(headers.ifModifiedSince, null);
    });

    it('handles If-Unmodified-Since header', () => {
      let headers = new SuperHeaders();

      assert.equal(headers.ifUnmodifiedSince, null);

      headers.ifUnmodifiedSince = new Date('2021-01-01T00:00:00Z');
      assert.ok(headers.ifUnmodifiedSince instanceof Date);
      assert.equal(headers.ifUnmodifiedSince.toUTCString(), 'Fri, 01 Jan 2021 00:00:00 GMT');

      headers.ifUnmodifiedSince = null;
      assert.equal(headers.ifUnmodifiedSince, null);
    });

    it('handles Set-Cookie header', () => {
      let headers = new SuperHeaders();

      assert.deepEqual(headers.setCookie, []);

      headers.setCookie = 'session=abc';
      assert.equal(headers.setCookie.length, 1);
      assert.equal(headers.setCookie[0].name, 'session');
      assert.equal(headers.setCookie[0].value, 'abc');

      headers.setCookie = { name: 'session', value: 'def' };
      assert.equal(headers.setCookie.length, 1);
      assert.equal(headers.setCookie[0].name, 'session');
      assert.equal(headers.setCookie[0].value, 'def');

      headers.setCookie = ['session=abc', 'theme=dark'];
      assert.equal(headers.setCookie.length, 2);
      assert.equal(headers.setCookie[0].name, 'session');
      assert.equal(headers.setCookie[0].value, 'abc');
      assert.equal(headers.setCookie[1].name, 'theme');
      assert.equal(headers.setCookie[1].value, 'dark');

      // Can use ...spread to add new cookies
      headers.setCookie = [...headers.setCookie, 'lang=en'];
      assert.equal(headers.setCookie.length, 3);
      assert.equal(headers.setCookie[2].name, 'lang');
      assert.equal(headers.setCookie[2].value, 'en');

      headers.setCookie = [
        { name: 'session', value: 'def' },
        { name: 'theme', value: 'light' },
      ];
      assert.equal(headers.setCookie.length, 2);
      assert.equal(headers.setCookie[0].name, 'session');
      assert.equal(headers.setCookie[0].value, 'def');
      assert.equal(headers.setCookie[1].name, 'theme');
      assert.equal(headers.setCookie[1].value, 'light');

      // Can use push() to add new cookies
      headers.setCookie.push({ name: 'lang', value: 'fr' });
      assert.equal(headers.setCookie.length, 3);
      assert.equal(headers.setCookie[2].name, 'lang');
      assert.equal(headers.setCookie[2].value, 'fr');

      headers.setCookie = null;
      assert.deepEqual(headers.setCookie, []);
    });
  });

  describe('toString', () => {
    it('omits empty values when stringified', () => {
      let headers = new SuperHeaders();

      // This should appear in the string since it has a media type, it's complete
      headers.contentType = 'text/plain';

      // This should not appear in the string since it's incomplete, missing the type
      headers.contentDisposition.filename = 'example.txt';

      assert.equal(headers.toString(), 'Content-Type: text/plain');
    });
  });
});
