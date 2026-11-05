Fix two cases where the dev server could stop responding to requests or file changes:

- Requests waiting on `createHmrReadyFetch()` no longer hang forever after a restart that was requested while a hot update was still being accepted, for example when an accept handler asks for a restart because a component module's client entries changed.
- Changes to watched server files are no longer missed after the runner stops watching a directory that contains another watched directory.
