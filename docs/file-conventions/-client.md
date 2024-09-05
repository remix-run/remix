---
title: ".client modules"
toc: false
---

# `.client` modules

While uncommon, you may have a file or dependency that uses module side effects in the browser. You can use `*.client.ts` on file names or nest files within `.client` directories to force them out of server bundles.

```ts filename=feature-check.client.ts
// this would break the server
export const supportsVibrationAPI =
  "vibrate" in window.navigator;
```

Note that values exported from this module will all be `undefined` on the server, so the only places to use them are in [`useEffect`][use_effect] and user events like click handlers.

```ts
import { supportsVibrationAPI } from "./feature-check.client.ts";

console.log(supportsVibrationAPI);
// server: undefined
// client: true | false
```

<docs-warning>`.client` directories are only supported when using [Remix Vite][remix-vite]. The [Classic Remix Compiler][classic-remix-compiler] only supports `.client` files.</docs-warning>

Refer to the Route Module section in the sidebar for more information.

[use_effect]: https://react.dev/reference/react/useEffect
[classic-remix-compiler]: ../guides/vite#classic-remix-compiler-vs-remix-vite
[remix-vite]: ../guides/vite
