import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import { openFixture } from '../../test/utils.js';

import { TarParser } from './tar.js';

function readFixture(name: string): ReadableStream<Uint8Array> {
  let stream = openFixture(name).stream();
  return name.endsWith('.tgz') ? stream.pipeThrough(new DecompressionStream('gzip')) : stream;
}

describe('TarParser', () => {
  it('parses express-4.21.1.tgz', async () => {
    let stream = readFixture('express-4.21.1.tgz');
    let parser = new TarParser();

    let entries: [string, number][] = [];

    await parser.parse(stream, (entry) => {
      entries.push([entry.name, entry.size]);
    });

    assert.deepEqual(entries, [
      ['package/LICENSE', 1249],
      ['package/lib/application.js', 14593],
      ['package/lib/express.js', 2409],
      ['package/index.js', 224],
      ['package/lib/router/index.js', 15123],
      ['package/lib/middleware/init.js', 853],
      ['package/lib/router/layer.js', 3296],
      ['package/lib/middleware/query.js', 885],
      ['package/lib/request.js', 12505],
      ['package/lib/response.js', 28729],
      ['package/lib/router/route.js', 4399],
      ['package/lib/utils.js', 5871],
      ['package/lib/view.js', 3325],
      ['package/package.json', 2708],
      ['package/History.md', 114974],
      ['package/Readme.md', 9806],
    ]);
  });

  it('parses react-18.0.0.tgz', async () => {
    let stream = readFixture('react-18.0.0.tgz');
    let parser = new TarParser();

    let entries: [string, number][] = [];

    await parser.parse(stream, (entry) => {
      entries.push([entry.name, entry.size]);
    });

    assert.deepEqual(entries, [
      ['package/LICENSE', 1086],
      ['package/index.js', 190],
      ['package/jsx-dev-runtime.js', 222],
      ['package/jsx-runtime.js', 214],
      ['package/cjs/react-jsx-dev-runtime.development.js', 41115],
      ['package/cjs/react-jsx-dev-runtime.production.min.js', 343],
      ['package/cjs/react-jsx-dev-runtime.profiling.min.js', 342],
      ['package/cjs/react-jsx-runtime.development.js', 41714],
      ['package/cjs/react-jsx-runtime.production.min.js', 859],
      ['package/cjs/react-jsx-runtime.profiling.min.js', 858],
      ['package/cjs/react.development.js', 87561],
      ['package/umd/react.development.js', 109891],
      ['package/cjs/react.production.min.js', 6932],
      ['package/umd/react.production.min.js', 10756],
      ['package/umd/react.profiling.min.js', 10755],
      ['package/cjs/react.shared-subset.development.js', 501],
      ['package/react.shared-subset.js', 218],
      ['package/cjs/react.shared-subset.production.min.js', 351],
      ['package/package.json', 999],
      ['package/README.md', 737],
    ]);
  });
});
