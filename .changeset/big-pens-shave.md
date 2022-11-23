---
"@remix-run/cloudflare-workers-esm": patch
"@remix-run/dev": patch
---

Support Cloudflare Module Workers (ESM)

Remix can now build & deploy Cloudflare Module Workers, which use ES Modules syntax. This is the preferred way to write Cloudflare Workers, as they support additional features such as Durable Objects.

To write a Remix Module Worker, import the `@remix-run/cloudflare-workers-esm` package:

```ts
import { createEventHandler } from "@remix-run/cloudflare-workers-esm";

import * as build from "../build";

export default { fetch: createEventHandler({ build }) };
```

More information on the difference between Service Worker and Module Worker syntax is available [in the Cloudflare docs](https://developers.cloudflare.com/workers/runtime-apis/fetch-event#syntax-module-worker).