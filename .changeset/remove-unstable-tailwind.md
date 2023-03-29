---
"@remix-run/dev": major
"@remix-run/react": major
"@remix-run/server-runtime": major
"@remix-run/testing": major
---

Remove `unstable_tailwind` option. Tailwind functions and directives are now automatically supported in CSS files if `tailwindcss` is installed. If needed, this feature can be disabled by setting the `tailwind` option to `false` in `remix.config.js`.
