---
title: Quick Start (5m)
order: 2
---

# Quick Start

This guide will get you familiar with the basic plumbing required to run a Remix app as quickly as possible. While there are many starter templates with different runtimes, deploy targets, and databases, we're going to create a bare-bones project from scratch.

When you're ready to get serious about your Remix project, you might consider starting with a community template. They include typescript setups, databases, testing harnesses, authentication, and more. You can find a list of community templates on the [Remix Guide Templates][templates] page.

## Installation

```shellscript nonumber
$ mkdir my-remix-app
$ cd my-remix-app

# install runtime dependencies
$ npm i @remix-run/node @remix-run/serve @remix-run/react react react-dom

# install dev dependencies
$ npm i -D @remix-run/dev
```

Make sure to update package.json to indicate this project uses es modules:

```json filename=package.json
{
  "type": "module"
  // ...
}
```

## The Root Route

```shellscript nonumber
$ mkdir app
$ touch app/root.jsx
```

`app/root.jsx` is what we call the "Root Route". It's the root layout of your entire app. Here's the basic set of elements you'll need for any project:

```jsx
import {
  Meta,
  Links,
  Scripts,
  Outlet,
} from "@remix-run/react";

export default function Root() {
  return (
    <html>
      <head>
        <link
          rel="icon"
          href="data:image/x-icon;base64,AA"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <h1>Hello world!</h1>
        <Outlet />

        <Scripts />
      </body>
    </html>
  );
}
```

## Build and Run

First build the app for production:

```shellscript nonumber
$ remix build
```

You should now see a `build/` folder (the server version of your app) and `public/build` folder (the browser version) with some build artifacts in them. (This is all [configurable][remixconfig].)

👉 **Run the app with `remix-serve`**

```shellscript nonumber
# note the dash!
$ remix-serve build/index.js
```

You should be able to open up [http://localhost:3000][http-localhost-3000] and see the "hello world" page.

Aside from the unholy amount of code in node_modules, our Remix app is just one file:

```
├── app
│   └── root.jsx
└── package.json
```

## Bring Your Own Server

The `build/` directory created by `remix build` is just a module that you run inside of a server like Express, Cloudflare Workers, Netlify, Vercel, Fastly, AWS, Deno, Azure, Fastify, Firebase ... anywhere.

If you don't care to set up your own server, you can use `remix-serve`. It's a simple express-based server maintained by the Remix team. However, Remix is specifically designed to run in _any_ JavaScript environment so that you own your stack. It is expected many—if not most—production apps will have their own server. You can read more about this in [Runtimes, Adapters, and Stacks][runtimes].

Just for kicks, let's stop using `remix-serve` and use express instead.

👉 **Install Express and the Remix Express adapter**

```shellscript nonumber
$ npm i express @remix-run/express

# not going to use this anymore
$ npm uninstall @remix-run/serve
```

👉 **Create an Express server**

```shellscript nonumber
$ touch server.mjs
```

```js filename=server.mjs
import { createRequestHandler } from "@remix-run/express";
import express from "express";

// notice that the result of `remix build` is "just a module"
import * as build from "./build/index.js";

const app = express();
app.use(express.static("public"));

// and your app is "just a request handler"
app.all("*", createRequestHandler({ build }));

app.listen(3000, () => {
  console.log("App listening on http://localhost:3000");
});
```

👉 **Run your app with express**

```shellscript nonumber
$ node server.mjs
```

Now that you own your server, you can debug your app with whatever tooling your server has. For example, you can inspect your app with chrome devtools with the [Node.js inspect flag][inspect]:

```shellscript nonumber
$ node --inspect server.mjs
```

## Development Workflow

Instead of stopping, rebuilding, and starting your server all the time, you can run Remix in development. This enables instant feedback to changes in your app with React Refresh (Hot Module Replacement) and Remix Hot Data Revalidation.

First add a dev command in package.json that will run `remix dev`:

👉 **Add a "scripts" entry to package.json**

```json lines=[3-5]
{
  "type": "module",
  "scripts": {
    "dev": "remix dev -c \"node server.mjs\""
  }
  //...
}
```

This will start the Remix development server which will watch your files for changes and rebuild your app. The `-c` flag tell it how to start your actual application server.

When files change, Remix will restart your server for you, but because you own your server, you also have to tell Remix when it has restarted so Remix can safely send the hot updates to the browser.

👉 **Add `broadcastDevReady` to your server**

```js filename=server.mjs lines=[1,14-16]
import { createRequestHandler } from "@remix-run/express";
import { broadcastDevReady } from "@remix-run/node";
import express from "express";

import * as build from "./build/index.js";

const app = express();
app.use(express.static("public"));

// and your app is "just a request handler"
app.all("*", createRequestHandler({ build }));

app.listen(4000, () => {
  if (process.env.NODE_ENV === "development") {
    broadcastDevReady(build);
  }
  console.log("App listening on http://localhost:4000");
});
```

And finally, let's connect your UI in the browser to receive those broadcasts:

```tsx filename=app/root.tsx lines=[6,25]
import {
  Meta,
  Links,
  Scripts,
  Outlet,
  LiveReload,
} from "@remix-run/react";

export default function Root() {
  return (
    <html>
      <head>
        <link
          rel="icon"
          href="data:image/x-icon;base64,AA"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <h1>Dope</h1>
        <Outlet />

        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
```

👉 **Start the dev server**

```shellscript nonumber
npm run dev
```

Now you can work on your app with immediate feedback. Give it a shot, change the text in `root.jsx` and watch!

## Controlling Server and Browser Entries

There are default magic files Remix is using that most apps don't need to mess with, but if you want to customize Remix's entry points to the server and browser you can run `remix reveal` and they'll get dumped into your project.

```shellscript nonumber
$  remix reveal
Entry file entry.client created at app/entry.client.tsx.
Entry file entry.server created at app/entry.server.tsx.
```

## Summary

Congrats, you can add Remix to your resume! Summing things up, we've learned:

- `remix build` and `remix dev` compile your app into two things:
  - A request handler that you add to your own JavaScript server
  - A pile of static assets in your public directory for the browser
- You can bring your own server with adapters to deploy anywhere.
- You can set up a development workflow with HMR built-in

In general, Remix is a bit "guts out". A few minutes of boilerplate but now you own your stack.

What's next?

- [Tutorial][tutorial]

[fetch]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[runtimes]: ../book/01-runtimes
[inspect]: https://nodejs.org/en/docs/guides/debugging-getting-started/
[tutorial]: ./tutorial
[book]: ../book/00-introduction
[remixconfig]: ../file-conventions/remix-config
[templates]: https://remix.guide/templates
[http-localhost-3000]: http://localhost:3000
