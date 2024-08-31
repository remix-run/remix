# node-fetch-server

`node-fetch-server` allows you to build servers for Node.js that use the [web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) primitives (namely [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)) instead of the traditional `req`/`res` API used in libraries like [Express](https://expressjs.com/).

This web standard API is already used in many places across the JavaScript ecosystem:

- [`Bun.serve`](https://bun.sh/docs/api/http#bun-serve)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)
- [`Deno.serve`](https://docs.deno.com/api/deno/~/Deno.serve)
- [Fastly Compute](https://js-compute-reference-docs.edgecompute.app/docs/)

When you write servers using the `Request` and `Response` APIs, you maximize the chances that your code will be portable across all these different JavaScript runtimes.

## Features

- Use web standard [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) APIs for building servers, instead of node-specific API
- Seamless integration with `node:http` and `node:https` modules
- Supports custom hostnames (e.g. using `process.env.HOST` on a VPS to set the host portion of incoming request URLs)
- Supports streaming responses using `new Response(stream)`
- Exposes client IP info
- It's [faster than Express](#benchmark)

## Installation

```sh
npm install @mjackson/node-fetch-server
```

## Usage

```ts
import * as http from 'node:http';
import { type FetchHandler, createRequestListener } from '@mjackson/node-fetch-server';

let handler: FetchHandler = (request) => {
  return new Response('Hello, world!');
};

let server = http.createServer(createRequestListener(handler));

server.listen(3000);
```

By default `request.url` is derived from the value of the `Host` HTTP header and the connection protocol being used. To support custom hostnames using e.g. a `$HOST` environment variable, you can use the `host` option:

```ts
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { type FetchHandler, createRequestListener } from '@mjackson/node-fetch-server';

let handler: FetchHandler = (request) => {
  // This is now true
  assert.equal(new URL(request.url).host, process.env.HOST);
  return new Response('Hello, world!');
};

let server = http.createServer(createRequestListener(handler, { host: process.env.HOST }));

server.listen(3000);
```

Information about the remote client IP and port is passed as the 2nd argument to your `FetchHandler`:

```ts
import { type FetchHandler } from '@mjackson/node-fetch-server';

let handler: FetchHandler = (request, client) => {
  return new Response(`The client IP address is ${client.address}`);
};
```

## Benchmark

A basic benchmark shows `node-fetch-server` is able to serve more requests per second (and has higher overall throughput) than Express v4. The vanilla `node:http` module is also shown as a baseline for comparison.

```
> @mjackson/node-fetch-server@0.1.0 bench /Users/michael/Projects/remix-the-web/packages/node-fetch-server
> bash ./bench/runner.sh

Platform: Darwin (23.5.0)
CPU: Apple M1 Pro
Date: 8/31/2024, 1:55:21 PM

Running benchmark for node:http@22.1.0 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    37.16ms  127.85ms   1.93s    97.71%
    Req/Sec     1.65k   380.84     4.42k    84.81%
  590123 requests in 30.09s, 121.00MB read
  Socket errors: connect 0, read 432, write 224, timeout 0
Requests/sec:  19612.18
Transfer/sec:      4.02MB

Running benchmark for node-fetch-server@0.1.0 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    44.04ms  103.32ms   1.98s    98.46%
    Req/Sec     0.93k   175.11     1.90k    81.25%
  332998 requests in 30.10s, 68.28MB read
  Socket errors: connect 0, read 1394, write 115, timeout 152
Requests/sec:  11062.58
Transfer/sec:      2.27MB

Running benchmark for express@4.19.2 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    48.72ms   90.75ms   1.98s    98.88%
    Req/Sec   746.08    249.77     4.40k    82.81%
  266534 requests in 30.10s, 64.31MB read
  Socket errors: connect 0, read 745, write 60, timeout 186
Requests/sec:   8854.66
Transfer/sec:      2.14MB
```

I encourage you to run the benchmark yourself. To do so, you'll need to have [`wrk`](https://github.com/wg/wrk) installed. Then run:

```sh
pnpm run bench
```

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)
