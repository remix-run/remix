import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseProtocol } from './parse.ts';

describe('parse', () => {
  it('parses protocol', () => {
    assert.deepStrictEqual(parseProtocol('http(s)'), [
      { span: [0, 4], type: 'text', value: 'http' },
      { span: [4, 3], type: 'optional', nodes: [{ span: [5, 1], type: 'text', value: 's' }] },
    ]);
  });
});
