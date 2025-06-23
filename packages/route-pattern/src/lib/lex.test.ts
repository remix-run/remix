import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lexProtocol, lexHostname, lexPathname } from './lex.ts';

describe('lex', () => {
  it('lexes protocol', () => {
    assert.deepStrictEqual(Array.from(lexProtocol('http(s)')), [
      { span: [0, 4], type: 'text', value: 'http' },
      { span: [4, 1], type: '(' },
      { span: [5, 1], type: 'text', value: 's' },
      { span: [6, 1], type: ')' },
    ]);
  });
  it('lexes hostname', () => {
    assert.deepStrictEqual(Array.from(lexHostname('(*tenant.:sub.)remix.run')), [
      { span: [0, 1], type: '(' },
      { span: [1, 7], type: 'glob', name: 'tenant' },
      { span: [8, 1], type: 'text', value: '.' },
      { span: [9, 4], type: 'param', name: 'sub' },
      { span: [13, 1], type: 'text', value: '.' },
      { span: [14, 1], type: ')' },
      { span: [15, 9], type: 'text', value: 'remix.run' },
    ]);
  });
  it('lexes pathname', () => {
    assert.deepStrictEqual(Array.from(lexPathname('/products/:id(/v:version/*path)')), [
      { span: [0, 10], type: 'text', value: '/products/' },
      { span: [10, 3], type: 'param', name: 'id' },
      { span: [13, 1], type: '(' },
      { span: [14, 2], type: 'text', value: '/v' },
      { span: [16, 8], type: 'param', name: 'version' },
      { span: [24, 1], type: 'text', value: '/' },
      { span: [25, 5], type: 'glob', name: 'path' },
      { span: [30, 1], type: ')' },
    ]);
  });
});
