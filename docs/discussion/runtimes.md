---
title: Runtimes, Adapters, Templates, and Deployment
order: 2
---

# Runtimes, Adapters, Templates, and Deployment

Deploying a Remix application has four layers:

1. A JavaScript Runtime like Node.js
2. A JavaScript web server like Express.js
3. A server adapter like `@remix-run/express`
4. A web host or platform

Depending on your web host, you may have fewer layers. For example, deploying to Cloudflare Pages takes care of 2, 3, and 4 all at once. Deploying Remix inside an Express app will have all four, and using the "Remix App Server" combines 2 and 3!

You can wire all of these up yourself, or start with a Remix Template.

Let's talk about what each part does.

## JavaScript Runtimes

Remix can be deployed to any JavaScript runtime like Node.js, Shopify Oxygen, Cloudflare Workers/Pages, Fastly Compute, Deno, Bun, etc.

Each runtime has varying support for the standard Web APIs that Remix is built on, so Remix runtime package is required to polyfill any missing features of the runtime. These polyfills include web standard APIs like Request, Response, crypto, and more. This allows you to use the same APIs on the server as in the browser.

The following runtimes packages are available:

- [`@remix-run/cloudflare-pages`][remix_run_cloudflare_pages]
- [`@remix-run/cloudflare-workers`][remix_run_cloudflare_workers]
- [`@remix-run/deno`][remix_run_deno]
- [`@remix-run/node`][remix_run_node]

The majority of the APIs you interact with in your app are not imported directly from these packages, so your code is fairly portable between runtimes. However, occasionally you'll import something from these packages for a specific feature that isn't a standard Web API.

For example, you might want to store cookies on the file system, or in Cloudflare KV storage. These are specific features of runtimes that aren't shared with other runtimes:

```tsx
// store sessions in cloudflare KV storage
import { createWorkersKVSessionStorage } from "@remix-run/cloudflare";

// store sessions on the file system in node
import { createFileSessionStorage } from "@remix-run/node";
```

But if you're storing a session in the cookie itself, this is supported in all runtimes:

```tsx
import { createCookieSessionStorage } from "@remix-run/node"; // or cloudflare/deno
```

## Adapters

Remix is not an HTTP server, but rather a handler inside an existing HTTP server. Adapters allow the Remix handler to run inside the HTTP server. Some JavaScript runtimes, especially Node.js, have multiple ways to create an HTTP server. For example, in Node.js you can use Express.js, fastify, or raw `http.createServer`.

Each of these servers has its own Request/Response API. The adapter's job is to convert the incoming request to a Web Fetch Request, run the Remix handler, and then adapt the Web Fetch Response back to the host server's response API.

Here's some pseudocode that illustrates the flow.

```tsx
// import the app build created by `remix build`
import build from "./build/index.js";

// an express http server
const app = express();

// and here your Remix app is "just a request handler"
app.all("*", createRequestHandler({ build }));

// This is pseudo code, but illustrates what adapters do:
export function createRequestHandler({ build }) {
  // creates a Fetch API request handler from the server build
  const handleRequest = createRemixRequestHandler(build);

  // returns an express.js specific handler for the express server
  return async (req, res) => {
    // adapts the express.req to a Fetch API request
    const request = createRemixRequest(req);

    // calls the app handler and receives a Fetch API response
    const response = await handleRequest(request);

    // adapts the Fetch API response to the express.res
    sendRemixResponse(res, response);
  };
}
```

### Remix App Server

For convenience, the Remix App Server is a basic express server for new projects, tinkering, or projects that don't have any specific needs from a server like Express and are deployed to Node.js environments.

See [`@remix-run/serve`][serve]

## Templates

Remix is designed to be incredibly flexible with just enough opinions to connect the UI to the back end, but it doesn't bring opinions on the database you use, how you cache data, or where and how your app is deployed.

Remix templates are starting points for app development with all of these extra opinions baked in, created by the community.

You can use a template with the `--template` flag in the Remix CLI that points to a repository on GitHub:

```
npx create-remix@latest --template <org>/<repo>
```

You can read more about templates in the [Templates Guide][templates_guide].

Once you've picked a template or [set up an app from scratch][quickstart], you're ready to start building your app!

[templates]: https://remix.guide/templates
[serve]: ../other-api/serve
[quickstart]: ../start/quickstart
[templates_guide]: ../guides/templates
[remix_run_cloudflare_pages]: https://npm.im/@remix-run/cloudflare-pages
[remix_run_cloudflare_workers]: https://npm.im/@remix-run/cloudflare-workers
[remix_run_deno]: https://npm.im/@remix-run/deno
[remix_run_node]: https://npm.im/@remix-run/node
