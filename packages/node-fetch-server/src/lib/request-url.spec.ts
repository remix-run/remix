import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as http from 'node:http';

import { getRequestUrl } from './request-url.js';
import { createTrustProxy } from './trust-proxy.js';

describe('getRequestUrl', () => {
  it('returns the URL of an incoming request', () => {
    let trustProxy = createTrustProxy();
    let req = {
      socket: {
        encrypted: false,
        remoteAddress: '127.0.0.1',
      },
      headers: {
        host: 'example.com',
      },
      url: '/path?query',
    } as unknown as http.IncomingMessage;

    assert.equal(getRequestUrl(req, trustProxy).toString(), 'http://example.com/path?query');
  });

  it('returns the URL of an incoming request on a secure connection', () => {
    let trustProxy = createTrustProxy();
    let req = {
      socket: {
        encrypted: true,
        remoteAddress: '127.0.0.1',
      },
      headers: {
        host: 'example.com',
      },
      url: '/path?query',
    } as unknown as http.IncomingMessage;

    assert.equal(getRequestUrl(req, trustProxy).toString(), 'https://example.com/path?query');
  });

  it('returns the URL of an incoming request with a forwarded protocol', () => {
    let trustProxy = createTrustProxy(true);
    let req = {
      socket: {
        encrypted: false,
        remoteAddress: '127.0.0.1',
      },
      headers: {
        'x-forwarded-proto': 'https',
        host: 'example.com',
      },
      url: '/path?query',
    } as unknown as http.IncomingMessage;

    assert.equal(getRequestUrl(req, trustProxy).toString(), 'https://example.com/path?query');
  });

  it('returns the URL of an incoming request with a forwarded host', () => {
    let trustProxy = createTrustProxy(true);
    let req = {
      socket: {
        encrypted: false,
        remoteAddress: '127.0.0.1',
      },
      headers: {
        'x-forwarded-host': 'mjackson.me',
        host: 'example.com',
      },
      url: '/path?query',
    } as unknown as http.IncomingMessage;

    assert.equal(getRequestUrl(req, trustProxy).toString(), 'http://mjackson.me/path?query');
  });
});
