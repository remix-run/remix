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
- Exposes remote client address info

## Installation

```sh
npm install @mjackson/node-fetch-server
```

## Usage

```ts
import * as http from 'node:http';
import { createRequestListener } from '@mjackson/node-fetch-server';

let handler = (request: Request) => {
  return new Response('Hello, world!');
};

let server = http.createServer(createRequestListener(handler));

server.listen(3000);
```

By default `request.url` is derived from the value of the `Host` HTTP header and the connection protocol being used. To support custom hostnames using e.g. a `HOST` environment variable, you can use the `host` option:

```ts
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import { createRequestListener } from '@mjackson/node-fetch-server';

let handler = (request: Request) => {
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

## Related Packages

- [`fetch-proxy`](https://github.com/mjackson/remix-the-web/tree/main/packages/fetch-proxy) - Build HTTP proxy servers using the web fetch API

## Benchmark

A basic "hello world" benchmark shows `node-fetch-server` introduces considerable overhead on top of a vanilla `node:http` server. However, it is still able to serve more requests per second (and has higher overall throughput) than Express v4, so the slowdown should be acceptable for most applications.

```
> @mjackson/node-fetch-server@0.0.0 bench /Users/michael/Projects/remix-the-web/packages/node-fetch-server
> bash ./bench/runner.sh

Platform: Darwin (24.0.0)
CPU: Apple M1 Pro
Date: 11/14/2024, 2:30:22 PM

Running benchmark for node:http@22.8.0 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     9.97ms   31.92ms 786.67ms   99.09%
    Req/Sec     4.45k   268.33     6.38k    93.69%
  1594257 requests in 30.02s, 326.89MB read
  Socket errors: connect 0, read 1317, write 6, timeout 0
Requests/sec:  53110.92
Transfer/sec:     10.89MB

Running benchmark for node-fetch-server@0.1.0 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    22.74ms   81.06ms   1.46s    98.22%
    Req/Sec     2.42k   185.82     4.30k    91.80%
  866347 requests in 30.03s, 177.64MB read
  Socket errors: connect 0, read 1496, write 3, timeout 0
Requests/sec:  28849.46
Transfer/sec:      5.92MB

Running benchmark for express@4.19.2 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    36.46ms  125.89ms   1.99s    97.89%
    Req/Sec     1.56k   146.86     2.93k    88.25%
  558504 requests in 30.06s, 134.76MB read
  Socket errors: connect 0, read 1261, write 11, timeout 36
Requests/sec:  18579.11
Transfer/sec:      4.48MB
```

## License

See [LICENSE](https://github.com/mjackson/remix-the-web/blob/main/LICENSE)
