Add `crawl()` API for prerendering and static-site generation

- `crawl(router, options?)` returns an async iterable that fetches every reachable URL in a router, yielding a `CrawlResult` (`{ pathname, filepath, response }`) for each page
- HTML responses are parsed for navigation links (`<a href>` and `<link rel="alternate" href>`) and referenced assets (`<link href>`, `<script src>`, `<img src>`);
- The `spider` and `concurrency` options on `CrawlOptions` control link-following and parallelism
- `crawl()` throws on non-2xx responses so missing pages surface as build failures.

```ts
import { crawl } from 'remix/fetch-router'

for await (let { pathname, filepath, response } of crawl(router)) {
  await writeResponseToDisk(filepath, response)
}
```
