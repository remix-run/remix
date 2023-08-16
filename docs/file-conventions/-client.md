---
title: "*.client.ts extension"
---

# `*.client.ts`

While uncommon, you may have a file or dependency that needs uses module side-effects in the browser. You can use `*.client.ts` on file names to force them out of server bundles.

```ts filename=feature-check.client.ts
// this would break the server
export const supportsVibrationAPI =
  "vibrate" in window.navigator;
```

Note that values exported from this module will all be `undefined` on the server, so the only places to use them are in `useEffect` and user events like click handlers.

```ts
import { supportsVibrationAPI } from "./feature-check.client.ts";

console.log(supportsVibrationAPI);
// server: undefined
// client: true | false
```

See [Route Module][routemodule] for more information.

[routemodule]: ../route/route-module
