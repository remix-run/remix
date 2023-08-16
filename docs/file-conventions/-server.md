---
title: "*.server.ts extension"
---

# `*.server.ts`

While not always necessary, you can use `*.server.ts` on file names to force them out of client bundles. Usually the compiler is fine, but if you've got a server dependency with module side-effects, move it into a `your-name.server.ts` file to ensure it is removed from client bundles.

See [Route Module][routemodule] for more information.

[routemodule]: ../route/route-module
