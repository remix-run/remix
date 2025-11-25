# UNPKG Demo

A lo-fi clone of [unpkg.com](https://unpkg.com) that lets you browse the contents of any npm package. This demo showcases tarball parsing, filesystem caching, HTML templating, and clean URL routing with catch-all patterns.

## Running the Demo

```bash
cd demos/unpkg
pnpm install
pnpm start
```

Then visit http://localhost:44100

Try browsing packages:

- http://localhost:44100/lodash
- http://localhost:44100/react@18
- http://localhost:44100/@remix-run/cookie
- http://localhost:44100/express/package.json

## Code Highlights

- [`app/routes.ts`](app/routes.ts) uses a single `/*path` route to handle all package URLs. This one pattern handles package names, versions, scoped packages, and file paths.
- [`app/lib/npm.ts`](app/lib/npm.ts) fetches package tarballs from npm, decompresses them with `node:zlib`, and parses them using `@remix-run/tar-parser`. The `parsePackagePath()` function handles the tricky parsing of URLs like `/@remix-run/cookie@1.0.0/src/index.ts`.
- Also in [`app/lib/npm.ts`](app/lib/npm.ts), `resolveVersion()` handles dist-tags like `latest`, exact versions, and partial versions (e.g., `18` resolves to `18.3.1`).
- [`app/lib/cache.ts`](app/lib/cache.ts) caches decompressed tarballs to the temp directory using `@remix-run/file-storage`. This avoids re-downloading packages on repeated requests.
- [`app/lib/render.ts`](app/lib/render.ts) uses the `html` template tag from `@remix-run/html-template` for safe HTML generation with automatic XSS escaping.
