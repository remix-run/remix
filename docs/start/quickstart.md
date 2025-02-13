---
title: Quick Start (5m)
order: 1
---

# Quick Start

<docs-warning>Just getting started with Remix? The latest version of [Remix is now React Router v7][remix-now-react-router]. If you want to use the latest features, you should use the [React Router docs to get started][react-router-get-started].</docs-warning>

This guide will get you familiar with the basic plumbing required to run a Remix app as quickly as possible. While there are many starter templates with different runtimes, deploy targets, and databases, we're going to create a bare-bones project from scratch.

When you're ready to get serious about your Remix project, you might consider starting with a community template. They include TypeScript setups, databases, testing harnesses, authentication, and more. You can find a list of community templates on the [Remix Resources][templates] page.

## Installation

If you prefer to initialize a batteries-included Remix project, you can use the [`create-remix` CLI][create-remix]:

```shellscript nonumber
npx create-remix@latest
```

However, this guide will explain everything the CLI does to set up your project, and instead of using the CLI you can follow these steps. If you're just getting started with Remix, we recommend following this guide to understand all of the different pieces that make up a Remix app.

```shellscript nonumber
mkdir my-remix-app
cd my-remix-app
npm init -y

# install runtime dependencies
npm i @remix-run/node @remix-run/react @remix-run/serve isbot@4 react react-dom

# install dev dependencies
npm i -D @remix-run/dev vite
```

## Vite Config

```shellscript nonumber
touch vite.config.js
```

Since Remix uses [Vite], you'll need to provide a [Vite config][vite-config] with the Remix Vite plugin. Here's the basic configuration you'll need:

```js filename=vite.config.js
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [remix()],
});
```

## The Root Route

```shellscript nonumber
mkdir app
touch app/root.jsx
```

`app/root.jsx` is what we call the "Root Route". It's the root layout of your entire app. Here's the basic set of elements you'll need for any project:

```jsx filename=app/root.jsx
import {
  Links,
  Meta,
  Outlet,
  Scripts,
} from "@remix-run/react";

export default function App() {
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
npx remix vite:build
```

You should now see a `build` folder containing a `server` folder (the server version of your app) and a `client` folder (the browser version) with some build artifacts in them. (This is all [configurable][vite_config].)

👉 **Run the app with `remix-serve`**

First you will need to specify the type in `package.json` as module so that `remix-serve` can run your app.

```jsonc filename=package.json lines=[2] nocopy
{
  "type": "module"
  // ...
}
```

Now you can run your app with `remix-serve`:

```shellscript nonumber
# note the dash!
npx remix-serve build/server/index.js
```

You should be able to open up [http://localhost:3000][http-localhost-3000] and see the "hello world" page.

Aside from the unholy amount of code in `node_modules`, our Remix app is just three files:

```
├── app/
│   └── root.jsx
├── package.json
└── vite.config.js
```

## Bring Your Own Server

The `build/server` directory created by `remix vite:build` is just a module that you run inside a server like Express, Cloudflare Workers, Netlify, Vercel, Fastly, AWS, Deno, Azure, Fastify, Firebase, ... anywhere.

If you don't care to set up your own server, you can use `remix-serve`. It's a simple express-based server maintained by the Remix team. However, Remix is specifically designed to run in _any_ JavaScript environment so that you own your stack. It is expected many —if not most— production apps will have their own server. You can read more about this in [Runtimes, Adapters, and Stacks][runtimes].

Just for kicks, let's stop using `remix-serve` and use express instead.

👉 **Install Express, the Remix Express adapter, and [cross-env] for running in production mode**

```shellscript nonumber
npm i express @remix-run/express cross-env

# not going to use this anymore
npm uninstall @remix-run/serve
```

👉 **Create an Express server**

```shellscript nonumber
touch server.js
```

```js filename=server.js
import { createRequestHandler } from "@remix-run/express";
import express from "express";

// notice that the result of `remix vite:build` is "just a module"
import * as build from "./build/server/index.js";

const app = express();
app.use(express.static("build/client"));

// and your app is "just a request handler"
app.all("*", createRequestHandler({ build }));

app.listen(3000, () => {
  console.log("App listening on http://localhost:3000");
});
```

👉 **Run your app with express**

```shellscript nonumber
node server.js
```

Now that you own your server, you can debug your app with whatever tooling your server has. For example, you can inspect your app with chrome devtools with the [Node.js inspect flag][inspect]:

```shellscript nonumber
node --inspect server.js
```

## Development Workflow

Instead of stopping, rebuilding, and starting your server all the time, you can run Remix in development using [Vite in middleware mode][vite-middleware]. This enables instant feedback to changes in your app with React Refresh (Hot Module Replacement) and Remix Hot Data Revalidation.

First, as a convenience, add `dev` and `start` commands in `package.json` that will run your server in development and production modes respectively:

👉 **Add a "scripts" entry to `package.json`**

```jsonc filename=package.json lines=[2-4] nocopy
{
  "scripts": {
    "dev": "node ./server.js",
    "start": "cross-env NODE_ENV=production node ./server.js"
  }
  // ...
}
```

👉 **Add Vite development middleware to your server**

Vite middleware is not applied if `process.env.NODE_ENV` is set to `"production"`, in which case you'll still be running the regular build output as you did earlier.

```js filename=server.js lines=[4-11,14-18,20-25]
import { createRequestHandler } from "@remix-run/express";
import express from "express";

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? null
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true },
        })
      );

const app = express();
app.use(
  viteDevServer
    ? viteDevServer.middlewares
    : express.static("build/client")
);

const build = viteDevServer
  ? () =>
      viteDevServer.ssrLoadModule(
        "virtual:remix/server-build"
      )
  : await import("./build/server/index.js");

app.all("*", createRequestHandler({ build }));

app.listen(3000, () => {
  console.log("App listening on http://localhost:3000");
});
```

👉 **Start the dev server**

```shellscript nonumber
npm run dev
```

Now you can work on your app with immediate feedback. Give it a shot, change the text in `root.jsx` and watch!

## Controlling Server and Browser Entries

There are default magic files Remix is using that most apps don't need to mess with, but if you want to customize Remix's entry points to the server and browser you can run `remix reveal` and they'll get dumped into your project.

```shellscript nonumber
npx remix reveal
```

```
Entry file entry.client created at app/entry.client.tsx.
Entry file entry.server created at app/entry.server.tsx.
```

## Summary

Congrats, you can add Remix to your resume! Summing things up, we've learned:

- Remix compiles your app into two things:
  - A request handler that you add to your own JavaScript server
  - A pile of static assets in your public directory for the browser
- You can bring your own server with adapters to deploy anywhere
- You can set up a development workflow with HMR built-in

In general, Remix is a bit "guts out". A few minutes of boilerplate but now you own your stack.

What's next?

- [Tutorial][tutorial]

[create-remix]: ../other-api/create-remix
[runtimes]: ../discussion/runtimes
[inspect]: https://nodejs.org/en/docs/guides/debugging-getting-started/
[tutorial]: ./tutorial
[vite_config]: ../file-conventions/vite-config
[templates]: /resources?category=templates
[http-localhost-3000]: http://localhost:3000
[es-modules]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
[vite]: https://vitejs.dev
[vite-config]: https://vitejs.dev/config
[vite-middleware]: https://vitejs.dev/guide/ssr#setting-up-the-dev-server
[cross-env]: https://www.npmjs.com/package/cross-env
[remix-now-react-router]: https://remix.run/blog/incremental-path-to-react-19
[react-router-get-started]: https://reactrouter.com/start/framework/installation
