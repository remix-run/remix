# UNPKG Demo

A lo-fi clone of [unpkg.com](https://unpkg.com) that lets you browse the contents of any npm package. This demo showcases tarball parsing, filesystem caching, HTML templating, and clean URL routing with catch-all patterns.

## Running the Demo

```bash
cd demos/unpkg
pnpm install
pnpm start
```

Then visit http://localhost:44100

Semver ranges are supported (via the [semver](https://www.npmjs.com/package/semver) package). URLs without a version, or with partial/range versions, automatically redirect to the fully resolved version.

## Code Highlights

- [`app/routes.js`](app/routes.js) uses a single `/*path` route to handle all package URLs. This one pattern handles package names, versions, scoped packages, and file paths.
- [`app/lib/npm.js`](app/lib/npm.js) fetches package tarballs from npm, decompresses them with `node:zlib`, and parses them using `@remix-run/tar-parser`. The `parsePackagePath()` function handles the tricky parsing of URLs like `/@remix-run/cookie@1.0.0/src/index.js`.
- Also in [`app/lib/npm.js`](app/lib/npm.js), `resolveVersion()` handles dist-tags like `latest`, exact versions, partial versions (e.g., `18` resolves to `18.3.1`), and semver ranges (e.g., `^18.2` or `~1.0.0`).
- [`app/lib/cache.js`](app/lib/cache.js) caches decompressed tarballs to the temp directory using `@remix-run/file-storage`. This avoids re-downloading packages on repeated requests.
- [`app/lib/render.js`](app/lib/render.js) uses the `html` template tag from `@remix-run/html-template` for safe HTML generation with automatic XSS escaping.
