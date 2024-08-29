import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createTrustProxy } from './trust-proxy.js';

describe('createTrustProxy', () => {
  it('does not trust by default', () => {
    let trustProxy = createTrustProxy();
    assert.ok(!trustProxy('10.0.0.5', 0));
  });

  it('trusts all proxies', () => {
    let trustProxy = createTrustProxy(true);
    assert.ok(trustProxy('10.0.0.5', 0));
  });

  it('does not trust any proxies', () => {
    let trustProxy = createTrustProxy(false);
    assert.ok(!trustProxy('10.0.0.5', 0));
  });

  it('trusts a function that returns true', () => {
    let trustProxy = createTrustProxy(() => true);
    assert.ok(trustProxy('10.0.0.5', 0));
  });

  it('does not trust a function that returns false', () => {
    let trustProxy = createTrustProxy(() => false);
    assert.ok(!trustProxy('10.0.0.5', 0));
  });

  it('trusts a single IP address', () => {
    let trustProxy = createTrustProxy('127.0.0.1');
    assert.ok(trustProxy('127.0.0.1', 0));
  });

  it('trusts a list of IP addresses', () => {
    let trustProxy = createTrustProxy('127.0.0.1,10.0.0.5');
    assert.ok(trustProxy('10.0.0.5', 0));
  });

  it('trusts a list of IP addresses as an array', () => {
    let trustProxy = createTrustProxy(['127.0.0.1', '10.0.0.5']);
    assert.ok(trustProxy('10.0.0.5', 0));
  });
});
