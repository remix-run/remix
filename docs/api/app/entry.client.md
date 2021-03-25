---
title: entry.client.js
---

Remix uses `app/entry.client.js` as the entry point for the browser bundle. This module gives you full control over the "hydrate" step after JavaScript loads into the document.

Typically this module uses `ReactDOM.hydrate` to re-hydrate the markup that was already generated on the server in your [server entry module](../entry.server).

Here's a basic example:

```tsx
import ReactDOM from "react-dom";
import Remix from "@remix-run/react/browser";

ReactDOM.hydrate(<Remix />, document);
```

As you can see, you have full control over hydration. This is the first piece of code that runs in the browser. As you can see, you have full control here. You can initialize client side libraries, setup thing likes `window.history.scrollRestoration`, etc.
