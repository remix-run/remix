---
"@remix-run/dev": patch
---

Vite: add `--sourcemap` flag to `remix vite:build`

- `--sourcemap` enables source maps for client and server
- `--sourcemap=client` enables source maps for client and server
- `--sourcemap=server` enables source maps for client and server

Also supports `inline` and `hidden` variants:

- `--sourcemap=inline`
- `--sourcemap=client-inline`
- `--sourcemap=server-inline`

- `--sourcemap=hidden`
- `--sourcemap=client-hidden`
- `--sourcemap=server-hidden`

See https://vitejs.dev/config/build-options.html#build-sourcemap
