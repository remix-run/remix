Fix cases where the dev server could stop responding to requests, miss file changes, or crash:

- Requests waiting on `createHmrReadyFetch()` no longer hang forever when a restart is requested while a hot update is still being accepted, for example when an accept handler asks for a restart because a component module's client entries changed.
- A file change made right after the server reports ready is no longer missed. `ready()` now also waits until newly watched directories are being watched.
- Changes to the files a server module imports are no longer missed after that module is hot updated. Previously the runner stopped watching the module's unchanged imports once the update was accepted.
- Changes to watched server files are no longer missed after the runner stops watching a directory that contains another watched directory.
- A file watcher error is now logged instead of crashing the dev server.
