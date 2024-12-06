import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MemoryFileStorage } from './memory-file-storage.ts';

describe('MemoryFileStorage', () => {
  it('stores and retrieves files', async () => {
    let storage = new MemoryFileStorage();
    let file = new File(['Hello, world!'], 'hello.txt', { type: 'text/plain' });

    storage.set('hello', file);

    assert.ok(storage.has('hello'));

    let retrieved = storage.get('hello');

    assert.ok(retrieved);
    assert.equal(retrieved.name, 'hello.txt');
    assert.equal(retrieved.type, 'text/plain');
    assert.equal(retrieved.size, 13);

    let text = await retrieved.text();

    assert.equal(text, 'Hello, world!');

    storage.remove('hello');

    assert.ok(!storage.has('hello'));
    assert.equal(storage.get('hello'), null);
  });
});
