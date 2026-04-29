Add `pool` option (`threads` | `forks`) to control how each test file is isolated

The default `threads` runs each file in a `worker_threads.Worker` (current behavior). The new `forks` option runs each file in a `child_process.fork` subprocess for full process-level isolation, at the cost of higher per-file startup overhead. Configurable via `pool` in `remix-test.config.ts` or the `--pool` CLI flag.
