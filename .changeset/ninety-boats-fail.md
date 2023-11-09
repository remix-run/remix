---
"@remix-run/dev": patch
---

fix(vite): deduplicate `@remix-run/react`

Pre-bundle Remix dependencies to avoid Remix router duplicates.
Our remix-remix-react-proxy plugin does not process default client and
server entry files since those come from within `node_modules`.
That means that before Vite pre-bundles dependencies (e.g. first time dev server is run)
mismatching Remix routers cause `Error: You must render this element inside a <Remix> element`.
