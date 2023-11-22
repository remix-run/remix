---
"@remix-run/dev": patch
---

Change Vite build output paths to fix a conflict between how Vite and the Remix compiler each manage the `public` directory.

**This is a breaking change for projects using the unstable Vite plugin.**

The server is now compiled into `build/server` rather than `build`, and the client is now compiled into `build/client` rather than `public`.

For more information on the changes and guidance on how to migrate your project, refer to the updated [Remix Vite documentation](https://remix.run/docs/en/main/future/vite).