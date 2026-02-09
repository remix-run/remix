Add `basePath` option to mount static files at a URL prefix

When set, only requests whose pathname starts with the given prefix are served; the prefix is stripped before resolving the file under the root directory. Enables serving a directory at a path like `/assets` instead of the root (e.g. `staticFiles('./build/assets', { basePath: '/assets' })`).
