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
| Cold import heap     |     193 KiB |   698 KiB |   2.14 MiB |
| Cold import RSS      |    3.42 MiB |  4.20 MiB |  10.89 MiB |
| Retained heap/schema |   17.20 KiB | 19.40 KiB | 198.13 KiB |
| Retained RSS/schema  |   23.50 KiB | 35.20 KiB | 261.11 KiB |

| Workload       | Metric     | data-schema |     Valibot |         Zod |
| -------------- | ---------- | ----------: | ----------: | ----------: |
| Valid object   | Throughput | 1.26M ops/s | 1.03M ops/s | 1.22M ops/s |
| Invalid object | Throughput |  539k ops/s |  286k ops/s |   48k ops/s |
| Valid array    | Throughput | 11.1k ops/s |  8.6k ops/s | 10.9k ops/s |
| Invalid array  | Throughput |  3.9k ops/s |  1.6k ops/s |  0.7k ops/s |
| Valid object   | Peak heap  |    2.05 MiB |    4.03 MiB |    4.07 MiB |
| Invalid object | Peak heap  |    4.33 MiB |   17.98 MiB |   50.58 MiB |
| Valid array    | Peak heap  |   19.39 MiB |   25.32 MiB |   21.53 MiB |
| Invalid array  | Peak heap  |   21.16 MiB |   94.64 MiB |  103.63 MiB |

| Retained heap/result | data-schema |    Valibot |        Zod |
| -------------------- | ----------: | ---------: | ---------: |
| Valid object         |       372 B |      498 B |      365 B |
| Invalid object       |    1.67 KiB |   8.01 KiB |   8.94 KiB |
| Valid array          |   32.14 KiB |  43.50 KiB |  32.40 KiB |
| Invalid array        |  168.09 KiB | 914.16 KiB | 775.79 KiB |

`data-schema` has the smallest import and schema footprint, leads successful-validation throughput,
and uses the least heap across every validation workload. Zod retains a 7-byte advantage per valid
object result; `data-schema` retains slightly less memory for valid array results.
