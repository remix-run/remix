Fixes for dev servers using `remix/node-hmr`:

- Requests no longer hang and file changes are no longer missed after some hot updates and restarts, and file watcher errors are logged instead of crashing the server.
- Changing files while the previous server process is still shutting down no longer starts an extra server process that keeps running in the background.

See the [`@remix-run/node-hmr` changelog](https://github.com/remix-run/remix/blob/main/packages/node-hmr/CHANGELOG.md) for the specific cases.
