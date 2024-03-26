---
"remix": patch
"@remix-run/dev": patch
---

Name remixDevServerMiddleware and make it a standalone plugin giving subsequent Vite plugins a means to remove the dev server plugin, or the middleware it adds from the dev server.
