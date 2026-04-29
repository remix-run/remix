Add `pool` option (`threads` | `forks`) to control how each test file is isolated

`forks` (the default) runs each file in a `child_process.fork` subprocess for full process-level isolation. `threads` runs each file in a `worker_threads.Worker`, which has lower per-file startup overhead but shares the host process. Configurable via `pool` in `remix-test.config.ts` or the `--pool` CLI flag.
