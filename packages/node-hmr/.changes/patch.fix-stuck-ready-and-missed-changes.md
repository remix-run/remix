Fix two cases where the dev server could stop responding to requests or file changes:

- Requests waiting on `createHmrReadyFetch()` no longer hang forever when a hot update's accept handler asks for a restart (for example when a component module's client entries change) and then finishes accepting the update.
- Changes to watched server files are no longer missed or misreported as additions after a hot update stops watching a parent directory of a watched directory.
