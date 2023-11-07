---
"@remix-run/dev": patch
---

fix(vite): Let Vite handle serving files outside of project root via `/@fs`

This fixes errors when using default client entry or server entry in a pnpm project
where those files may be outside of the project root, but within the workspace root.

By default, Vite prevents access to files outside the workspace root
(when using workspaces) or outside of the project root (when not using
workspaces) unless user explicitly opts into it via Vite's `server.fs.allow`.
