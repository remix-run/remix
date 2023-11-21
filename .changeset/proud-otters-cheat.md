---
"@remix-run/dev": patch
---

Fix redundant copying of assets from `public` directory in Vite build. This ensures that static assets aren't duplicated in the server build directory. This also fixes an issue where the build would break if `assetsBuildDirectory` was deeply nested within the `public` directory.
