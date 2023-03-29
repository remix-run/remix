---
"@remix-run/dev": major
"@remix-run/react": major
"@remix-run/server-runtime": major
"@remix-run/testing": major
---

Remove `unstable_postcss` option. CSS files are now automatically processed using PostCSS if `postcss.config.js` is present. If needed, this feature can be disabled by setting the `postcss` option to `false` in `remix.config.js`.
