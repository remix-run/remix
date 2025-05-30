import * as assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFormData } from '@mjackson/form-data-parser';

import { LocalFileStorage } from './local-file-storage.ts';

const __dirname = new URL('.', import.meta.url).pathname;

describe('LocalFileStorage', () => {
  let directory = path.resolve(__dirname, '../../test-local-file-storage');

  afterEach(() => {
    fs.rmSync(directory, { recursive: true });
  });

  it('stores and retrieves files', async () => {
    let storage = new LocalFileStorage(directory);
    let lastModified = Date.now();
    let file = new File(['Hello, world!'], 'hello.txt', {
      type: 'text/plain',
      lastModified,
    });

    await storage.set('hello', file);

    assert.ok(await storage.has('hello'));

    let retrieved = await storage.get('hello');

    assert.ok(retrieved);
    assert.equal(retrieved.name, 'hello.txt');
    assert.equal(retrieved.type, 'text/plain');
    assert.equal(retrieved.lastModified, lastModified);
    assert.equal(retrieved.size, 13);

    let text = await retrieved.text();

    assert.equal(text, 'Hello, world!');

    await storage.remove('hello');

    assert.ok(!(await storage.has('hello')));
    assert.equal(await storage.get('hello'), null);
  });

  it('lists files with pagination', async () => {
    let storage = new LocalFileStorage(directory);
    let allKeys = ['a', 'b', 'c', 'd', 'e'];

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    );

    let { cursor, files } = await storage.list();
    assert.equal(cursor, undefined);
    assert.equal(files.length, 5);
    assert.deepEqual(files.map((f) => f.key).sort(), allKeys);

    let { cursor: cursor1, files: files1 } = await storage.list({ limit: 0 });
    assert.equal(cursor1, undefined);
    assert.equal(files1.length, 0);

    let { cursor: cursor2, files: files2 } = await storage.list({ limit: 2 });
    assert.notEqual(cursor2, undefined);
    assert.equal(files2.length, 2);

    let { cursor: cursor3, files: files3 } = await storage.list({ cursor: cursor2 });
    assert.equal(cursor3, undefined);
    assert.equal(files3.length, 3);

    assert.deepEqual([...files2, ...files3].map((f) => f.key).sort(), allKeys);
  });

  it('lists files by key prefix', async () => {
    let storage = new LocalFileStorage(directory);
    let allKeys = ['a', 'b', 'b/c', 'c', 'd'];

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    );

    let { cursor, files } = await storage.list({ prefix: 'b' });
    assert.equal(cursor, undefined);
    assert.equal(files.length, 2);
    assert.deepEqual(files.map((f) => f.key).sort(), ['b', 'b/c']);
  });

  it('lists files with metadata', async () => {
    let storage = new LocalFileStorage(directory);
    let allKeys = ['a', 'b', 'c', 'd', 'e'];

    await Promise.all(
      allKeys.map((key) =>
        storage.set(key, new File([`Hello ${key}!`], `hello.txt`, { type: 'text/plain' })),
      ),
    );

    let { cursor, files } = await storage.list({ includeMetadata: true });
    assert.equal(cursor, undefined);
    assert.equal(files.length, 5);
    assert.deepEqual(files.map((f) => f.key).sort(), allKeys);
    files.forEach((f) => assert.ok('lastModified' in f));
    files.forEach((f) => assert.ok('name' in f));
    files.forEach((f) => assert.ok('size' in f));
    files.forEach((f) => assert.ok('type' in f));
  });

  it('handles race conditions', async () => {
    let storage = new LocalFileStorage(directory);
    let lastModified = Date.now();

    let file1 = new File(['Hello, world!'], 'hello1.txt', {
      type: 'text/plain',
      lastModified,
    });

    let file2 = new File(['Hello, universe!'], 'hello2.txt', {
      type: 'text/plain',
      lastModified,
    });

    let setPromise = storage.set('one', file1);
    await storage.set('two', file2);

    let retrieved1 = await storage.get('one');
    assert.ok(retrieved1);
    assert.equal(await retrieved1.text(), 'Hello, world!');

    await setPromise;
    let retrieved2 = await storage.get('two');
    assert.ok(retrieved2);
    assert.equal(await retrieved2.text(), 'Hello, universe!');
  });

  describe('integration with form-data-parser', () => {
    it('stores and lists file uploads', async () => {
      let storage = new LocalFileStorage(directory);

      let boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      let request = new Request('http://example.com', {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: [
          `--${boundary}`,
          'Content-Disposition: form-data; name="hello"; filename="hello.txt"',
          'Content-Type: text/plain',
          '',
          'Hello, world!',
          `--${boundary}--`,
        ].join('\r\n'),
      });

      await parseFormData(request, async (file) => {
        await storage.set('hello', file);
      });

      assert.ok(await storage.has('hello'));

      let { files } = await storage.list({ includeMetadata: true });

      assert.equal(files.length, 1);
      assert.equal(files[0].key, 'hello');
      assert.equal(files[0].name, 'hello.txt');
      assert.equal(files[0].size, 13);
      assert.equal(files[0].type, 'text/plain');
      assert.ok(files[0].lastModified);
    });
  });
});
