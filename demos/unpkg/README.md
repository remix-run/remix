# UNPKG Demo

A lo-fi clone of [unpkg.com](https://unpkg.com) that lets you browse the contents of any npm package. This demo showcases tarball parsing, filesystem caching, HTML templating, and clean URL routing with catch-all patterns while following the same controller-first app layout used by the other Remix demos.

## Running the Demo

```bash
cd demos/unpkg
pnpm install
pnpm start
```

Then visit http://localhost:44100

Semver ranges are supported (via the [semver](https://www.npmjs.com/package/semver) package). URLs without a version, or with partial/range versions, automatically redirect to the fully resolved version.

## Code Highlights

- [`app/router.ts`](app/router.ts) maps route maps to controllers, matching the layout conventions used by the other Remix demos.
- [`app/actions/controller.ts`](app/actions/controller.ts) owns the top-level home and package-browser actions.
- [`app/utils/npm.ts`](app/utils/npm.ts) fetches package tarballs from npm, decompresses them with `node:zlib`, and parses them using `@remix-run/tar-parser`. The `parsePackagePath()` function handles tricky URLs like `/@remix-run/cookie@1.0.0/src/index.ts`.
- [`app/utils/tarball-cache.ts`](app/utils/tarball-cache.ts) stores decompressed tarballs under the demo’s root `tmp/` directory using `remix/file-storage/fs`, which keeps runtime scratch data inside the demo itself.
- [`app/utils/render.ts`](app/utils/render.ts) and [`app/ui/document.ts`](app/ui/document.ts) keep the shared document shell separate from feature controllers.
