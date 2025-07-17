# tar-parser

`tar-parser` is a fast, efficient parser for [tar archives](<https://en.wikipedia.org/wiki/Tar_(computing)>). It can be used in any JavaScript environment (not just Node.js).

## Features

- Runs anywhere JavaScript runs
- Built on the standard [web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API), so it's composable with `fetch()` streams
- Supports POSIX, GNU, and PAX tar formats
- Memory efficient and does not buffer anything in normal usage
- 0 dependencies

## Installation

Install from [npm](https://www.npmjs.com/):

```sh
npm install @mjackson/tar-parser
```

## Usage

The main parser interface is the `parseTar(archive, handler)` function:

```ts
import { parseTar } from '@mjackson/tar-parser';

let response = await fetch(
  'https://github.com/mjackson/remix-the-web/archive/refs/heads/main.tar.gz',
);

await parseTar(response.body.pipeThrough(new DecompressionStream('gzip')), (entry) => {
  console.log(entry.name, entry.size);
});
```

If you're parsing an archive with filename encodings other than UTF-8, use the `filenameEncoding` option:

```ts
let response = await fetch(/* ... */);

await parseTar(response.body, { filenameEncoding: 'latin1' }, (entry) => {
  console.log(entry.name, entry.size);
});
```

## Benchmark

`tar-parser` performs on par with other popular tar parsing libraries on Node.js.

```
> @mjackson/tar-parser@0.0.0 bench /Users/michael/Projects/remix-the-web/packages/tar-parser
> node --disable-warning=ExperimentalWarning ./bench/runner.ts

Platform: Darwin (24.0.0)
CPU: Apple M1 Pro
Date: 12/6/2024, 11:00:55 AM
Node.js v22.8.0
┌────────────┬────────────────────┐
│ (index)    │ lodash npm package │
├────────────┼────────────────────┤
│ tar-parser │ '6.23 ms ± 0.58'   │
│ tar-stream │ '6.72 ms ± 2.24'   │
│ node-tar   │ '6.49 ms ± 0.44'   │
└────────────┴────────────────────┘
```

## Credits

`tar-parser` is based on the excellent [tar-stream package](https://www.npmjs.com/package/tar-stream) (MIT license) and adopts the same core parsing algorithm, utility functions, and many test cases.

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)
