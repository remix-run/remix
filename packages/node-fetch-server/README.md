# node-fetch-server

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
