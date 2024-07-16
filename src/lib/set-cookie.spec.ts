import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SetCookie } from './set-cookie.js';

describe('SetCookie', () => {
  it('parses initial value correctly', () => {
    let setCookie = new SetCookie(
      'session=abc123; Domain=example.com; Path=/; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Secure; HttpOnly'
    );
    assert.equal(setCookie.name, 'session');
    assert.equal(setCookie.value, 'abc123');
    assert.equal(setCookie.domain, 'example.com');
    assert.equal(setCookie.path, '/');
    assert.equal(setCookie.expires?.toUTCString(), 'Wed, 21 Oct 2015 07:28:00 GMT');
    assert.equal(setCookie.secure, true);
    assert.equal(setCookie.httpOnly, true);
  });

  it('handles cookies without attributes', () => {
    let setCookie = new SetCookie('user=john');
    assert.equal(setCookie.name, 'user');
    assert.equal(setCookie.value, 'john');
  });

  it('initializes with an empty string', () => {
    let setCookie = new SetCookie('');
    assert.equal(setCookie.name, undefined);
    assert.equal(setCookie.value, undefined);
  });

  it('handles cookie values with commas', () => {
    let setCookie = new SetCookie('list=apple,banana,cherry; Domain=example.com');
    assert.equal(setCookie.name, 'list');
    assert.equal(setCookie.value, 'apple,banana,cherry');
    assert.equal(setCookie.domain, 'example.com');
  });

  it('handles cookie values with semicolons', () => {
    let setCookie = new SetCookie('complex="value; with; semicolons"; Path=/');
    assert.equal(setCookie.name, 'complex');
    assert.equal(setCookie.value, 'value; with; semicolons');
    assert.equal(setCookie.path, '/');
  });

  it('handles cookie values with equals signs', () => {
    let setCookie = new SetCookie('equation="1+1=2"; Secure');
    assert.equal(setCookie.name, 'equation');
    assert.equal(setCookie.value, '1+1=2');
    assert.equal(setCookie.secure, true);
  });

  it('sets and gets attributes', () => {
    let setCookie = new SetCookie('test=value');
    setCookie.domain = 'example.org';
    setCookie.path = '/api';
    setCookie.maxAge = 3600;
    setCookie.secure = true;
    setCookie.httpOnly = true;
    setCookie.sameSite = 'Strict';

    assert.equal(setCookie.domain, 'example.org');
    assert.equal(setCookie.path, '/api');
    assert.equal(setCookie.maxAge, 3600);
    assert.equal(setCookie.secure, true);
    assert.equal(setCookie.httpOnly, true);
    assert.equal(setCookie.sameSite, 'Strict');
  });

  it('converts to string correctly', () => {
    let setCookie = new SetCookie('session=abc123');
    setCookie.domain = 'example.com';
    setCookie.path = '/';
    setCookie.secure = true;
    setCookie.httpOnly = true;
    setCookie.sameSite = 'Lax';

    assert.equal(
      setCookie.toString(),
      'session=abc123; Domain=example.com; Path=/; Secure; HttpOnly; SameSite=Lax'
    );
  });

  it('handles quoted values', () => {
    let setCookie = new SetCookie('complex="quoted value; with semicolon"');
    assert.equal(setCookie.name, 'complex');
    assert.equal(setCookie.value, 'quoted value; with semicolon');
  });

  it('parses and formats expires attribute correctly', () => {
    let expiresDate = new Date('Wed, 21 Oct 2015 07:28:00 GMT');
    let setCookie = new SetCookie(`test=value; Expires=${expiresDate.toUTCString()}`);
    assert.equal(setCookie.expires?.toUTCString(), expiresDate.toUTCString());

    setCookie.expires = new Date('Thu, 22 Oct 2015 07:28:00 GMT');
    assert.equal(setCookie.toString(), 'test=value; Expires=Thu, 22 Oct 2015 07:28:00 GMT');
  });

  it('handles SameSite attribute case-insensitively', () => {
    let setCookie = new SetCookie('test=value; SameSite=lax');
    assert.equal(setCookie.sameSite, 'Lax');

    setCookie = new SetCookie('test=value; SameSite=STRICT');
    assert.equal(setCookie.sameSite, 'Strict');

    setCookie = new SetCookie('test=value; SameSite=NoNe');
    assert.equal(setCookie.sameSite, 'None');
  });

  it('handles cookies with empty value', () => {
    let setCookie = new SetCookie('name=');
    assert.equal(setCookie.name, 'name');
    assert.equal(setCookie.value, '');
  });

  it('handles multiple identical attributes', () => {
    let setCookie = new SetCookie('test=value; Path=/; Path=/api');
    assert.equal(setCookie.path, '/api');
  });

  it('ignores unknown attributes', () => {
    let setCookie = new SetCookie('test=value; Unknown=something');
    assert.equal(setCookie.toString(), 'test=value');
  });

  it('handles Max-Age as a number', () => {
    let setCookie = new SetCookie('test=value; Max-Age=3600');
    assert.equal(setCookie.maxAge, 3600);
  });

  it('ignores invalid Max-Age', () => {
    let setCookie = new SetCookie('test=value; Max-Age=invalid');
    assert.equal(setCookie.maxAge, undefined);
  });

  it('handles missing value in attributes', () => {
    let setCookie = new SetCookie('test=value; Domain=; Path');
    assert.equal(setCookie.domain, '');
    assert.equal(setCookie.path, undefined);
  });

  it('preserves the case of the cookie name and value', () => {
    let setCookie = new SetCookie('TestName=TestValue');
    assert.equal(setCookie.name, 'TestName');
    assert.equal(setCookie.value, 'TestValue');
  });

  it('handles setting new name and value', () => {
    let setCookie = new SetCookie('old=value');
    setCookie.name = 'new';
    setCookie.value = 'newvalue';
    assert.equal(setCookie.toString(), 'new=newvalue');
  });

  it('correctly quotes values when necessary', () => {
    let setCookie = new SetCookie('test=value');
    setCookie.value = 'need; quotes';
    assert.equal(setCookie.toString(), 'test="need; quotes"');
  });
});
