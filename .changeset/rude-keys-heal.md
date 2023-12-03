---
"@remix-run/dev": patch
---

Vite: Preserve names for exports from .client imports

Unlike `.server` modules, the main idea is not to prevent code from leaking into the server build
since the client build is already public. Rather, the goal is to isolate the SSR render from client-only code.
Routes need to import code from `.client` modules without compilation failing and then rely on runtime checks
to determine if the code is running on the server or client.

Replacing `.client` modules with empty modules would cause the build to fail as ESM named imports are statically analyzed.
So instead, we preserve the named export but replace each exported value with an empty object.
That way, the import is valid at build time and the standard runtime checks can be used to determine if then
code is running on the server or client.
