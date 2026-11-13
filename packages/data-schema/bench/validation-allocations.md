# Validation allocation results

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

## Measurements

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

## Allocation change

A separate comparison used the same worker on the same machine, alternating between the base
([55600db](https://github.com/remix-run/remix/commit/55600dbf07c8f2e5c5fc605a6315bdc65b3f2eed)),
the initial shared-path implementation
([8694f2a](https://github.com/remix-run/remix/commit/8694f2ae0ecafe78b8f82e5b917034b8026d2391)),
and the current code. Each value is the median of five fresh-process trials.

| Workload       |         Base | Initial shared path | Current code |
| -------------- | -----------: | ------------------: | -----------: |
| Valid object   |  1.33M ops/s |         1.53M ops/s |  1.62M ops/s |
| Invalid object | 786.7k ops/s |        674.2k ops/s | 857.9k ops/s |
| Valid array    |  10.1k ops/s |         13.6k ops/s |  15.0k ops/s |
| Invalid array  |   4.5k ops/s |          4.8k ops/s |   5.2k ops/s |

The initial implementation scanned returned issues at each parent to copy shared paths. Copying
paths when issues are created removes those scans and the extra issue objects and lists. This also
keeps paths stable for error maps. Built-in validators run directly, while custom validators copy
shared contexts at their entry point, including calls through wrappers such as `optional()`.

Profiling and a comparison with only the issue-copying change confirmed that the repeated scans
accounted for most of the invalid-object slowdown. Removing the per-child built-in lookup and
validator forwarding call improved throughput further. In a longer check with 100,000 object
warmup validations and at least 500 ms of measurement per trial, median invalid-object throughput
was 1.48M ops/s for the base, 1.08M for the initial shared path, and 1.52M for the current code.
Treat small differences as run-to-run variation; the invalid-object regression is resolved in both
checks.
