---
title: entry.client
toc: false
---

# entry.client

Remix uses `app/entry.client.tsx` (or `.jsx`) as the entry point for the browser bundle. This module gives you full control over the "hydrate" step after JavaScript loads into the document.

Typically this module uses `ReactDOM.hydrate` to re-hydrate the markup that was already generated on the server in your [server entry module][server-entry-module].

Here's a basic example:

```tsx
import { hydrate } from "react-dom";
import { RemixBrowser } from "@remix-run/react";

hydrate(<RemixBrowser />, document);
```

This is the first piece of code that runs in the browser. As you can see, you have full control here. You can initialize client side libraries, setup things like `window.history.scrollRestoration`, etc.

[server-entry-module]: ./entry.server
