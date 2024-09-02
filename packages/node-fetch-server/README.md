# node-fetch-server

`node-fetch-server` allows you to build servers for Node.js that use the [web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) primitives (namely [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)) instead of the traditional `req`/`res` API used in libraries like [Express](https://expressjs.com/).

This web standard API is already used in many places across the JavaScript ecosystem:

- [`Bun.serve`](https://bun.sh/docs/api/http#bun-serve)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/)
- [`Deno.serve`](https://docs.deno.com/api/deno/~/Deno.serve)
- [Fastly Compute](https://js-compute-reference-docs.edgecompute.app/docs/)

When you write servers using the `Request` and `Response` APIs, you maximize the chances that your code will be portable across these different JavaScript runtimes.

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
> @mjackson/node-fetch-server@0.0.0 bench /Users/michael/Projects/remix-the-web/packages/node-fetch-server
> bash ./bench/runner.sh

Platform: Darwin (23.5.0)
CPU: Apple M1 Pro
Date: 8/31/2024, 5:43:47 PM

Running benchmark for node:http@22.1.0 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    22.28ms   71.96ms   1.36s    98.37%
    Req/Sec     2.37k   538.29     9.51k    85.30%
  848851 requests in 30.10s, 174.05MB read
  Socket errors: connect 0, read 544, write 27, timeout 0
Requests/sec:  28198.41
Transfer/sec:      5.78MB

Running benchmark for node-fetch-server@0.0.0 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    42.57ms  109.55ms   2.00s    98.37%
    Req/Sec     1.03k   282.58     2.78k    77.37%
  368110 requests in 30.10s, 75.48MB read
  Socket errors: connect 0, read 717, write 152, timeout 126
Requests/sec:  12228.31
Transfer/sec:      2.51MB

Running benchmark for express@4.19.2 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    48.76ms   87.38ms   2.00s    98.90%
    Req/Sec   734.60    190.17     3.03k    79.08%
  261725 requests in 30.09s, 63.15MB read
  Socket errors: connect 0, read 1259, write 110, timeout 200
Requests/sec:   8696.85
Transfer/sec:      2.10MB
```

I encourage you to run the benchmark yourself. To do so, you'll need to have [`wrk`](https://github.com/wg/wrk) installed. Then run:

```sh
pnpm run bench
```

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)
