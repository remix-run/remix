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

## Latest evidence

Recorded August 12, 2026 on an Apple M4 Pro running macOS 26.5 and Node 24.15.0. Values are the
median of five trials using `@remix-run/data-schema` 0.3.0, Valibot 1.4.2, and Zod 4.4.3.

| Memory metric        | data-schema |   Valibot |        Zod |
| -------------------- | ----------: | --------: | ---------: |
| Cold import heap     |     191 KiB |   698 KiB |   2.14 MiB |
| Cold import RSS      |    3.41 MiB |  4.27 MiB |  10.86 MiB |
| Retained heap/schema |   16.26 KiB | 19.40 KiB | 197.99 KiB |
| Retained RSS/schema  |   20.98 KiB | 35.32 KiB | 260.30 KiB |

| Workload       | Metric     | data-schema |     Valibot |         Zod |
| -------------- | ---------- | ----------: | ----------: | ----------: |
| Valid object   | Throughput | 1.12M ops/s | 1.05M ops/s | 1.22M ops/s |
| Invalid object | Throughput |  676k ops/s |  217k ops/s |   50k ops/s |
| Valid array    | Throughput |  8.5k ops/s |  8.6k ops/s | 10.9k ops/s |
| Invalid array  | Throughput |  3.9k ops/s |  1.6k ops/s |  0.7k ops/s |
| Valid object   | Peak heap  |    4.05 MiB |    4.03 MiB |    4.07 MiB |
| Invalid object | Peak heap  |    8.34 MiB |   18.12 MiB |   50.59 MiB |
| Valid array    | Peak heap  |   30.88 MiB |   25.38 MiB |   21.51 MiB |
| Invalid array  | Peak heap  |   40.09 MiB |   94.31 MiB |  103.24 MiB |

| Retained heap/result | data-schema |    Valibot |        Zod |
| -------------------- | ----------: | ---------: | ---------: |
| Valid object         |       483 B |      498 B |      365 B |
| Invalid object       |    2.73 KiB |   8.37 KiB |   8.94 KiB |
| Valid array          |   43.38 KiB |  43.50 KiB |  32.40 KiB |
| Invalid array        |  353.23 KiB | 914.36 KiB | 775.79 KiB |

`data-schema` has the smallest import and schema footprint and uses substantially less memory on
invalid inputs. Zod is modestly faster and retains smaller results on successful array validation.
