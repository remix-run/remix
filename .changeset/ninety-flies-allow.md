---
"@remix-run/dev": patch
---

- Fix public asset serving for non-Remix assets in the new dev server
- Add `--public-directory` / `unstable_dev.publicDirectory` option for configuring local directory for serving non-Remix assets like fonts
- Fix `svg` serving for new dev server
