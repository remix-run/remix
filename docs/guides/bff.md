---
title: Backend For Frontend
toc: false
---

# Backend For Your Frontend

While Remix can serve as your fullstack application, it also fits perfectly into the "Backend for your Frontend" architecture.

The BFF strategy employs a web server with a job scoped to serving the frontend web app and connecting it to the services it needs: your database, mailer, job queues, existing backend APIs (REST, GraphQL), etc. Instead of your UI integrating directly from the browser to these services, it connects to the BFF and the BFF connects to your services.

Mature apps already have a lot of backend application code in Ruby, Elixir, PHP, etc. and there's no reason to justify migrating it all to a server-side JavaScript runtime just to get the benefits of Remix. Instead, you can use your Remix app as a backend for your frontend.

Because Remix polyfills the Web Fetch API, you can use `fetch` right from your loaders and actions to your backend.

```tsx lines=[11,17,21]
import type { LoaderFunctionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import escapeHtml from "escape-html";

export async function loader({
  request,
}: LoaderFunctionArgs) {
  const apiUrl = "http://api.example.com/some-data.json";
  const res = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${process.env.API_TOKEN}`,
    },
  });

  const data = await res.json();

  const prunedData = data.map((record) => {
    return {
      id: record.id,
      title: record.title,
      formattedBody: escapeHtml(record.content),
    };
  });
  return json(prunedData);
}
```

There are several benefits of this approach vs. fetching directly from the browser. The highlighted lines above show how you can:

1. Simplify third party integrations and keep tokens and secrets out of client bundles.
2. Prune the data down to send less kB over the network, speeding up your app significantly.
3. Move a lot of code from browser bundles to the server, like `escapeHtml`, which speeds up your app. Additionally, moving code to the server usually makes your code easier to maintain since server-side code doesn't have to worry about UI states for async operations.

Again, Remix can be used as your only server by talking directly to the database and other services with server-side JavaScript APIs, but it also works perfectly as a backend for your frontend. Go ahead and keep your existing API server for application logic and let Remix connect the UI to it.
