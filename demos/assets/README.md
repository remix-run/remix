# assets demo

Minimal watch-mode demo for `remix/assets`.

It serves browser source from `app/actions/public/` through a long-lived Node server so you can edit client code, refresh the page, and verify that the assets update. The demo exercises TypeScript compilation, CSS imports, SVG file transforms, fingerprints, and the browser-source allowlist.

## Run

```sh
pnpm -C demos/assets dev
```

Then open [http://localhost:44100](http://localhost:44100).

Run `pnpm -C demos/assets test` to verify that every asset referenced by the document is served and that server-only action source is rejected.
