---
"@remix-run/dev": patch
---

Vite: reliably detect non-root routes in Windows

Sometimes route `file` will be unnormalized Windows path with `\` instead of `/`.
