# tar-parser

Streaming [tar archive](<https://en.wikipedia.org/wiki/Tar_(computing)>) parsing for JavaScript. `tar-parser` handles POSIX/GNU/PAX archives incrementally so large tar files can be processed without buffering the full payload.

## Features

- **Universal Runtime** - Runs anywhere JavaScript runs
- **Web Streams** - Built on the standard [web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API), so it's composable with `fetch()` streams
- **Format Support** - Supports POSIX, GNU, and PAX tar formats
- **Memory Efficient** - Does not buffer anything in normal usage
- **Zero Dependencies** - No external dependencies

## Installation

```sh
npm i remix
```

## Usage

The main parser interface is the `parseTar(archive, handler)` function:

```ts
import { parseTar } from 'remix/tar-parser'

let response = await fetch('https://github.com/remix-run/remix/archive/refs/heads/main.tar.gz')

await parseTar(response.body.pipeThrough(new DecompressionStream('gzip')), (entry) => {
  console.log(entry.name, entry.size)
})
```

If you're parsing an archive with filename encodings other than UTF-8, use the `filenameEncoding` option:

```ts
let response = await fetch(/* ... */)

await parseTar(response.body, { filenameEncoding: 'latin1' }, (entry) => {
  console.log(entry.name, entry.size)
})
```

Entry sizes must be non-negative safe integers. Use `entry.body` to stream content, or `entry.bytes()`, `entry.arrayBuffer()`, or `entry.text()` to buffer it. The buffering methods allocate from the bytes received and consume the body once. If parsing fails before an entry's body is complete, reading that body rejects with the parsing error.

```ts
await parseTar(archive, async (entry) => {
  if (entry.type === 'file' && entry.name.endsWith('.txt')) {
    console.log(entry.name, await entry.text())
  }
})
```

## Size Limits

The parser does not impose entry or archive size limits. Check `entry.size` in the handler before buffering an entry, and track the sum of entry sizes to enforce an aggregate limit:

```ts
let maxEntrySize = 10 * 1024 * 1024
let maxTotalSize = 100 * 1024 * 1024
let totalSize = 0

await parseTar(archive, (entry) => {
  if (entry.size > maxEntrySize) {
    throw new Error(`Entry exceeds size limit: ${entry.name}`)
  }

  totalSize += entry.size
  if (totalSize > maxTotalSize) {
    throw new Error('Total entry size exceeds limit')
  }

  return entry.bytes().then((bytes) => {
    console.log(entry.name, bytes.byteLength)
  })
})
```

Keep the callback synchronous so size-check errors stop parsing immediately; return a promise for subsequent asynchronous work. To also bound headers, padding, and extension metadata, limit the incoming archive stream after decompression.

## Benchmark

`tar-parser` performs on par with other popular tar parsing libraries on Node.js.

```
> @remix-run/tar-parser@0.0.0 bench /Users/michael/Projects/remix-the-web/packages/tar-parser
> node ./bench/runner.ts

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

## Related Packages

- [`multipart-parser`](https://github.com/remix-run/remix/tree/main/packages/multipart-parser) - Fast, streaming multipart parser for JavaScript

## Credits

`tar-parser` is based on the excellent [tar-stream package](https://www.npmjs.com/package/tar-stream) (MIT license) and adopts the same core parsing algorithm, utility functions, and many test cases.

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
