---
"@remix-run/dev": minor
---

Output esbuild metafiles for bundle analysis

Written to server build directory (`build/` by default):

- `metafile.css.json`
- `metafile.js.json` (browser JS)
- `metafile.server.json` (server JS)

Metafiles can be uploaded to https://esbuild.github.io/analyze/ for analysis.
