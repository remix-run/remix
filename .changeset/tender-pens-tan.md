---
"@remix-run/dev": patch
---

Vite: Enable use of [`vite preview`](https://main.vitejs.dev/guide/static-deploy.html#deploying-a-static-site) to preview Remix SPA applications
 - In the SPA template, `npm run start` has been renamed to `npm run preview` which uses `vite preview` instead of a standalone HTTP server such as `http-server` or `serv-cli`
