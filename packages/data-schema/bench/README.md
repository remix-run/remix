# data-schema benchmarks

These experimental benchmarks compare `@remix-run/data-schema`, Zod, and Valibot with equivalent
object schemas. They cover cold module import footprint, retained schema memory, validation
throughput, peak heap/RSS growth, and retained memory per validation result.

Every measurement runs in a fresh Node process with explicit garbage collection. The runner reports
the median of five trials by default. The benchmark builds `@remix-run/data-schema` first and loads
its distribution JavaScript, matching the code an installed package runs.

```sh
pnpm bench

# Override the number of trials
pnpm bench 9
```

Memory results are useful for comparing libraries on the same machine and Node version. RSS is
page-granular and V8 heap sizing is adaptive, so small differences should not be treated as exact.

## Latest stack results

Recorded September 8, 2026 on an Apple M5 Pro running macOS 26.6.2 and Node 24.15.0. Values are the median of five trials using the full stack, including the validation changes in [#11689 at `0b41dc6`](https://github.com/remix-run/remix/commit/0b41dc68284f2374672217dd6a55d4b9ad01b7f0), with package version 0.3.0, Valibot 1.4.2, and Zod 4.4.3.

| Memory metric        | data-schema |    Valibot |        Zod |
| -------------------- | ----------: | ---------: | ---------: |
| Cold import heap     |  193.41 KiB | 698.14 KiB |   2.13 MiB |
| Cold import RSS      |    3.59 MiB |   4.41 MiB |  10.69 MiB |
| Retained heap/schema |   15.83 KiB |  19.39 KiB | 197.99 KiB |
| Retained RSS/schema  |   22.62 KiB |  35.50 KiB | 260.33 KiB |

| Workload       | Metric     |  data-schema |      Valibot |         Zod |
| -------------- | ---------- | -----------: | -----------: | ----------: |
| Valid object   | Throughput |  1.64M ops/s |  1.31M ops/s | 1.48M ops/s |
| Invalid object | Throughput | 901.5k ops/s | 351.6k ops/s | 60.7k ops/s |
| Valid array    | Throughput |  14.8k ops/s |  10.4k ops/s | 13.1k ops/s |
| Invalid array  | Throughput |   5.4k ops/s |   1.8k ops/s |  0.8k ops/s |
| Valid object   | Peak heap  |     2.04 MiB |     4.02 MiB |    4.07 MiB |
| Invalid object | Peak heap  |     3.98 MiB |    17.99 MiB |   67.18 MiB |
| Valid array    | Peak heap  |    19.40 MiB |    25.32 MiB |   21.48 MiB |
| Invalid array  | Peak heap  |    20.91 MiB |    94.31 MiB |  103.70 MiB |
| Valid object   | Peak RSS   |      352 KiB |     2.69 MiB |     320 KiB |
| Invalid object | Peak RSS   |     4.42 MiB |    23.38 MiB |   66.59 MiB |
| Valid array    | Peak RSS   |    41.66 MiB |    44.38 MiB |   39.28 MiB |
| Invalid array  | Peak RSS   |    35.84 MiB |   128.95 MiB |  125.56 MiB |

| Retained heap/result | data-schema |    Valibot |        Zod |
| -------------------- | ----------: | ---------: | ---------: |
| Valid object         |       371 B |      498 B |      365 B |
| Invalid object       |    1.67 KiB |   8.00 KiB |   8.94 KiB |
| Valid array          |   32.14 KiB |  43.50 KiB |  32.40 KiB |
| Invalid array        |  168.13 KiB | 914.31 KiB | 775.79 KiB |

On these workloads, `data-schema` leads throughput in all four cases and has the lowest peak heap use, import footprint, and retained schema memory. Zod retains 6 fewer bytes per valid object and has lower peak RSS on successful inputs. Small memory differences should be treated as run-to-run variation.
