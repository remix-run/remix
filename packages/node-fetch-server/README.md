# node-fetch-server

## Benchmark

A basic benchmark shows `node-fetch-server` is able to serve more requests per second (and has higher overall throughput) than Express v4. The vanilla `node:http` module is also shown as a baseline for comparison.

```
> @mjackson/node-fetch-server@0.1.0 bench /Users/michael/Projects/remix-the-web/packages/node-fetch-server
> bash ./bench/runner.sh

Platform: Darwin (23.5.0)
CPU: Apple M1 Pro
Date: 8/31/2024, 12:14:41 PM

Running benchmark for node:http@22.1.0 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    31.70ms  109.12ms   2.00s    98.22%
    Req/Sec     1.69k   342.98     2.99k    87.16%
  606083 requests in 30.10s, 124.27MB read
  Socket errors: connect 0, read 633, write 117, timeout 20
Requests/sec:  20135.72
Transfer/sec:      4.13MB

Running benchmark for node-fetch-server@0.1.0 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    42.37ms   96.58ms   2.00s    98.66%
    Req/Sec     0.94k   255.57     3.01k    81.37%
  333862 requests in 30.10s, 68.46MB read
  Socket errors: connect 0, read 419, write 10, timeout 168
Requests/sec:  11091.24
Transfer/sec:      2.27MB

Running benchmark for express@4.19.2 ...

Running 30s test @ http://127.0.0.1:3000/
  12 threads and 400 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency    48.42ms   95.22ms   2.00s    98.83%
    Req/Sec   761.93    191.11     3.98k    79.46%
  272003 requests in 30.10s, 65.63MB read
  Socket errors: connect 0, read 835, write 3, timeout 189
Requests/sec:   9037.72
Transfer/sec:      2.18MB
```

I encourage you to run the benchmark yourself. To do so, you'll need to have [`wrk`](https://github.com/wg/wrk) installed. Then run:

```sh
pnpm run bench
```
