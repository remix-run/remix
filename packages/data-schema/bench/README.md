# data-schema benchmarks

These experimental benchmarks compare `@remix-run/data-schema`, Zod, and Valibot with equivalent
object schemas. They cover cold module import footprint, schema construction speed, retained schema
memory, validation throughput, peak heap/RSS growth, and retained memory per validation result.

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

A separate script bundles a few named imports of `@remix-run/data-schema` with esbuild and reports
their minified and gzipped sizes, so changes to tree shaking and bundle size show up:

```sh
pnpm bundle-size
```

## Latest stack results

Recorded November 6, 2026 on an Apple M3 Pro running macOS 15.7.7 and Node 24.14.0. Values are the median of three runs of five trials each using the inspectable schema objects from [#12106](https://github.com/remix-run/remix/pull/12106), with package version 1.0.0, Valibot 1.4.2, and Zod 4.4.3. Schema construction is sensitive to machine load, so it is the median of three separate rounds of nine `construct` trials instead.

| Memory metric        | data-schema |    Valibot |        Zod |
| -------------------- | ----------: | ---------: | ---------: |
| Cold import heap     |  209.74 KiB | 706.88 KiB |   2.16 MiB |
| Cold import RSS      |     960 KiB |   2.20 MiB |  10.58 MiB |
| Retained heap/schema |    5.41 KiB |  19.39 KiB | 197.99 KiB |
| Retained RSS/schema  |    9.34 KiB |  35.13 KiB | 259.18 KiB |

| Construction        | data-schema |     Valibot |        Zod |
| ------------------- | ----------: | ----------: | ---------: |
| Schema construction | 1.37M ops/s | 57.8k ops/s | 7.0k ops/s |

| Workload       | Metric     |  data-schema |      Valibot |         Zod |
| -------------- | ---------- | -----------: | -----------: | ----------: |
| Valid object   | Throughput |  1.30M ops/s | 871.3k ops/s | 1.13M ops/s |
| Invalid object | Throughput | 747.9k ops/s | 199.7k ops/s | 45.9k ops/s |
| Valid array    | Throughput |  11.1k ops/s |   7.3k ops/s | 10.1k ops/s |
| Invalid array  | Throughput |   3.6k ops/s |   1.4k ops/s |  0.6k ops/s |
| Valid object   | Peak heap  |     2.05 MiB |     4.04 MiB |    4.07 MiB |
| Invalid object | Peak heap  |     4.00 MiB |    18.61 MiB |   50.59 MiB |
| Valid array    | Peak heap  |    23.04 MiB |    25.42 MiB |   21.45 MiB |
| Invalid array  | Peak heap  |    20.97 MiB |    94.70 MiB |  103.39 MiB |
| Valid object   | Peak RSS   |     1.27 MiB |     3.45 MiB |    2.02 MiB |
| Invalid object | Peak RSS   |     4.80 MiB |    30.13 MiB |   64.77 MiB |
| Valid array    | Peak RSS   |    31.66 MiB |    43.28 MiB |   39.22 MiB |
| Invalid array  | Peak RSS   |    34.64 MiB |   122.27 MiB |  124.47 MiB |

| Retained heap/result | data-schema |    Valibot |        Zod |
| -------------------- | ----------: | ---------: | ---------: |
| Valid object         |       372 B |      500 B |      365 B |
| Invalid object       |    1.67 KiB |   8.36 KiB |   8.94 KiB |
| Valid array          |   32.14 KiB |  43.50 KiB |  32.40 KiB |
| Invalid array        |  167.99 KiB | 911.87 KiB | 775.78 KiB |

On these workloads, `data-schema` leads throughput in all four cases, builds schemas fastest, and has the lowest peak RSS, import footprint, and retained schema memory. It also has the lowest peak heap use except on valid arrays, where Zod's is lower. Zod retains 7 fewer bytes per valid object. Small memory differences should be treated as run-to-run variation.

Named-import bundles from the same checkout, built with esbuild 0.27.7:

| Import                                            | Minified |    Gzip |
| ------------------------------------------------- | -------: | ------: |
| `string()`                                        |  2,195 B |   836 B |
| `number()`                                        |  2,216 B |   853 B |
| `string().pipe(minLength(1))`                     |  2,352 B |   906 B |
| Nested `object()` with `array()` and `optional()` |  4,265 B | 1,559 B |
| Same, plus `parseSafe()`                          |  4,404 B | 1,616 B |
| Recursive `lazy()`                                |  4,133 B | 1,537 B |
| `number()` from `/coerce`                         |  2,449 B |   898 B |
| Form-data `object()` with `field()`               |  3,799 B | 1,345 B |
| `import * as s`                                   | 10,504 B | 2,972 B |
