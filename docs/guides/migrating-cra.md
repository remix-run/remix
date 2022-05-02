---
title: Migrating from Create React App
description: Remix makes integrating MDX into your project a breeze with built in routes and "import" support.
---

# Migrating from Create React App with React Router

Most apps bootstrapped with [Create React App](https://create-react-app.dev/) (CRA) already use [React Router](https://reactrouter.com/) for client-side routing. Because Remix is built on top of React Router, migration should be a relatively easy process.

If you aren't already using React Router, we think there are several compelling reasons to reconsider! History management, dynamic path matching, nested routing, and much more. Take a look at the [React Router docs](https://reactrouter.com/docs/en/v6/getting-started/concepts) and see what all we have to offer.

## Ensure your app uses React Router v6

If you are using an older version of React Router, the first step is to upgrade to v6. Check out the [migration guide from v5 to v6](https://reactrouter.com/docs/en/v6/upgrading/v5) and our [backwards compatibility package](https://www.npmjs.com/package/react-router-dom-v5-compat) to upgrade your app quickly.

## A note about non-standard imports

CRA supports several non-standard file imports in your JavaScript/TypeScript modules. Since such imports don't actually work in plain JavaScript, they have to be transformed by a compiler into something that makes sense at runtime. This includes things like styles, images, and SVG files.

Remix also supports some non-standard imports, but it's not a 1-to-1 mapping in terms of what we support or how we handle loading the file contents. Below is a non-exhaustive list of some of the differences you'll encounter in Remix.

### Images and fonts

CRA allows you to import image files, and result is a string representing the filepath of the image. This works the same way in Remix.

```js
import * as React from "react";

import logo from "./logo.png";

export function Logo() {
  return <img src={logo} alt="My logo" />;
}
```

This should work for fonts as well. In Remix, you'll generally import fonts in a route module and use them as the `href` of a `link` tag. [See our route loader docs for more information.](../api/conventions#loader)

### SVG

CRA allows you to import SVG files as React component. This is a common use case for SVG files, but it's not supported by default in Remix.

```js
import * as React from "react";

// This will not work in Remix!
import { ReactComponent as MyLogo } from "./logo.svg";

export function Logo() {
  return <MyLogo />;
}
```

If you want to use SVG files as React components, you'll need to first create the components and import them directly. [React SVGR](https://react-svgr.com/) is a great toolset that can help you generate these components from the [command line](https://react-svgr.com/docs/cli/) or in an [online playground](https://react-svgr.com/playground/) if you prefer to copy and paste.

### CSS imports

CRA supports importing CSS in your components in many ways. While this is common practice in the React ecosystem, it's not supported the same way in Remix for a few different reasons. We'll discuss this in depth a bit later, but for now just know that you need to import your stylesheets in route modules. Importing stylesheets directly in non-route components is not currently supported.

[Read more about route styles and why Remix does things a bit differently.](#route-stylesheets)

## Installing packages

First, you'll need a few of our packages to build on Remix. Follow the instructions below, running all commands from the root of your CRA project.

```shell
npm install @remix-run/react @remix-run/node
```

Because CRA apps are client-rendered by default, you may not have a server yet. All Remix apps run on a server, so we'll install a few packages to create one quickly.

```shell
npm install @remix-run/express express@4 compression@1 morgan@1
```

We'll also install a few other packages to help when running your Remix app in development.

```shell
npm install -D @remix-run/dev cross-env@7 nodemon@2 npm-run-all@4
```

## Configuration

### `remix.config.js`

Every Remix app accepts a `remix.config.js` file in the project root. While its settings are optional, we recommend you include a few of them for clarity's sake. See the [docs on configuration](../api/conventions#remixconfigjs) for more information about all available options.

By default, all app code in a CRA project is in the `src` directory. In Remix apps, we use the `app` directory by default. You can either change this to `src` in your `remix.config.js` or you can rename the `src` directory to `app`.

```js filename=remix.config.js
module.exports = {
  appDirectory: "app",
  ignoredRouteFiles: ["**/.*"],
  assetsBuildDirectory: "public/build",
};
```

### `jsconfig.json` or `tsconfig.json`

If you are using TypeScript, you likely already have a `tsconfig.json` in your project. `jsconfig.json` is optional but provides helpful context for many editors. These are the minimal settings we recommend including in your language configuration.

<docs-info>Remix uses the <code>~/_</code> path alias to easily import modules from the root no matter where your file lives in the project. If you change the `appDirectory` in your `remix.config.js`, you'll need to update your path alias for <code>~/_</code> as well.</docs-info>

```json filename=jsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "~/*": ["./app/*"]
    }
  }
}
```

```json filename=tsconfig.json
{
  "include": ["remix.env.d.ts", "**/*.ts", "**/*.tsx"],
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2019"],
    "isolatedModules": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "noEmit": true,
    "paths": {
      "~/*": ["./app/*"]
    }
  }
}
```

If you are using TypeScript, you also need to create the `remix.env.d.ts` file in the root of your project with the appropriate global type references.

```ts filename=remix.env.d.ts
/// <reference types="@remix-run/dev" />
/// <reference types="@remix-run/node/globals" />
```

## Setting up the server

Many apps built on CRA don't have a dedicated server for rendering the React application. Instead, the server is simply responsible for serving a static HTML file where React is mounted, and routing is managed on the client.

If you never set up a server for your app, that'll be our first step. Otherwise, keep reading until we talk about the Remix request handler!

### Building an Express server

<docs-info>

Just want to copy some code and move on? [Jump to the final server implementation.](#final-server)

</docs-info>

Start by creating a new file in the root of your directory named `server.js`.

```shell
touch server.js
```

Next, open that file in your editor. Import the `express` package. Its default export is a function we'll use to instantiate our server application. Note that we'll be using CommonJS `require` syntax when importing modules in this file.

```js filename=server.js
const express = require("express");
const app = express();
```

There are a few things we can do right out of the gate to make our server app a bit more secure and performant. First, we'll use the `compression` middleware to compress our HTTP responses.

```js filename=server.js lines=[4]
const express = require("express");
const app = express();

app.use(compression());
```

Next, disable the `"x-powered-by"` header as recommended by the Express docs as a security measure.

```js filename=server.js lines=[5]
const express = require("express");
const app = express();

app.use(compression());
app.disable("x-powered-by");
```

We want our server to serve our Remix build output as well as any static files in the `public` directory. We'll use the `express.static` middleware for that. CRA uses the `build` directory for its compiled output, so we'll use that as well.

```js filename=server.js lines=[2,7-14]
const express = require("express");
const compression = require("compression");
const app = express();

app.use(compression());
app.disable("x-powered-by");
app.use(
  "/build",
  express.static("public/build", {
    immutable: true,
    maxAge: "1y",
  })
);
app.use(express.static("public", { maxAge: "1h" }));
```

We'll use the `morgan` middleware to log requests to the console in a nice, readable format.

```js filename=server.js lines=[3,16]
const express = require("express");
const compression = require("compression");
const morgan = require("morgan");
const app = express();

app.use(compression());
app.disable("x-powered-by");
app.use(
  "/build",
  express.static("public/build", {
    immutable: true,
    maxAge: "1y",
  })
);
app.use(express.static("public", { maxAge: "1h" }));
app.use(morgan("tiny"));
```

Now it's time for the magic to happen. We need to tell our server how to respond to requests based on our Remix routes.

To do that, use our `@remix-run/express` package and import its `createRequestHandler` function. As its name implies, this function returns a request handler specifically for Express that serves the response for Remix. We'll call that function and provide the returned function to `app.all`, as we want Remix to handle all requests to all routes.

`createRequestHandler` needs two pieces of information about your app to work: we need to pass in the output of your build and the `NODE_ENV` environment variable.

```js filename=server.js lines=[4-7,10,24-30]
const express = require("express");
const compression = require("compression");
const path = require("path");
const morgan = require("morgan");
const {
  createRequestHandler,
} = require("@remix-run/express");
const app = express();

const BUILD_DIR = path.join(process.cwd(), "build");

app.use(compression());
app.disable("x-powered-by");
app.use(
  "/build",
  express.static("public/build", {
    immutable: true,
    maxAge: "1y",
  })
);
app.use(express.static("public", { maxAge: "1h" }));
app.use(morgan("tiny"));

app.all(
  "*",
  createRequestHandler({
    build: require(BUILD_DIR),
    mode: process.env.NODE_ENV,
  })
);
```

We can improve the experience during development quite a bit here by purging the [require cache](https://nodejs.org/api/modules.html#caching) before each request. This is a good idea to avoid memory leaks and other issues that can arise from caching, especially when using live reload.

We'll write a function called `purgeRequireCache` that will delete the cache for anything that requires our build output, and we'll call it cnoditionally when `NODE_ENV` is set to `development`.

```js filename=server.js lines=[26-37,40-46]
const express = require("express");
const compression = require("compression");
const path = require("path");
const morgan = require("morgan");
const {
  createRequestHandler,
} = require("@remix-run/express");
const app = express();

const BUILD_DIR = path.join(process.cwd(), "build");

app.use(compression());
app.disable("x-powered-by");
app.use(
  "/build",
  express.static("public/build", {
    immutable: true,
    maxAge: "1y",
  })
);
app.use(express.static("public", { maxAge: "1h" }));
app.use(morgan("tiny"));

app.all(
  "*",
  process.env.NODE_ENV === "development"
    ? (req, res, next) => {
        purgeRequireCache();
        return createRequestHandler({
          build: require(BUILD_DIR),
          mode: process.env.NODE_ENV,
        })(req, res, next);
      }
    : createRequestHandler({
        build: require(BUILD_DIR),
        mode: process.env.NODE_ENV,
      })
);

function purgeRequireCache() {
  for (let key in require.cache) {
    if (key.startsWith(BUILD_DIR)) {
      delete require.cache[key];
    }
  }
}
```

Lastly, we'll listen for requests on port 3000 when we run our server. Now we've got a fully-fledged server!

<a id="final-server"></a>

```js filename=server.js lines=[40-49]
const express = require("express");
const compression = require("compression");
const path = require("path");
const morgan = require("morgan");
const {
  createRequestHandler,
} = require("@remix-run/express");
const app = express();

const BUILD_DIR = path.join(process.cwd(), "build");

app.use(compression());
app.disable("x-powered-by");
app.use(
  "/build",
  express.static("public/build", {
    immutable: true,
    maxAge: "1y",
  })
);
app.use(express.static("public", { maxAge: "1h" }));
app.use(morgan("tiny"));

app.all(
  "*",
  process.env.NODE_ENV === "development"
    ? (req, res, next) => {
        purgeRequireCache();
        return createRequestHandler({
          build: require(BUILD_DIR),
          mode: process.env.NODE_ENV,
        })(req, res, next);
      }
    : createRequestHandler({
        build: require(BUILD_DIR),
        mode: process.env.NODE_ENV,
      })
);

const port = 3000;
app.listen(port, () => {
  console.log(`
    Your server is running!

    You can now view your Remix app in the browser.

    http://localhost:${port}
  `);
});

function purgeRequireCache() {
  for (let key in require.cache) {
    if (key.startsWith(BUILD_DIR)) {
      delete require.cache[key];
    }
  }
}
```

<docs-info>This tutorial closely mirrors the <a href="https://github.com/remix-run/remix/blob/main/templates/express/server.js">Express template in the Remix repo</a>.</docs-info>

## Creating server and browser entrypoints

In CRA, all of your React code runs in a browser. The server's only job here is to send a static HTML page for all route requests. Now that we have a full-fledged server, we need to tell it how to render our app on a per-route basis so that it knows what markup to send to the browser.

CRA gives you `index.js` which is your client entrypoint. We'll come back to that, but for now create two new files:

- `entry.server.jsx` (or `entry.server.tsx`)
- `entry.client.jsx` (or `entry.client.tsx`)

```js filename=entry.server.jsx
import { RemixServer } from "@remix-run/react";
import { renderToString } from "react-dom/server";

export default function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext
) {
  let markup = renderToString(
    <RemixServer context={remixContext} url={request.url} />
  );
  responseHeaders.set("Content-Type", "text/html");
  return new Response("<!DOCTYPE html>" + markup, {
    status: responseStatusCode,
    headers: responseHeaders,
  });
}
```

If you are using React 17, your client entrypoint will look like this:

```js filename=entry.client.jsx lines=[2,4]
import { RemixBrowser } from "@remix-run/react";
import { hydrate } from "react-dom";

hydrate(<RemixBrowser />, document);
```

In React 18, you'll use `hydrateRoot` instead of `hydrate`.

```js filename=entry.client.jsx lines=[2,4]
import { RemixBrowser } from "@remix-run/react";
import { hydrateRoot } from "react-dom/client";

hydrateRoot(document, <RemixBrowser />);
```

## Creating your routes

In CRA, the tool itself doesn't know or care about your routes. That's what React Router is there for, of course! By contrast, Remix is built on top of React Router, and routing is at the heart of how Remix works and where it shines. As such, we have some conventions on routing you'll want to follow.

How you end up migrating your routes depends on how you've set them up in your existing app using React Router 6. Remix has two methods for defining routes:

- Exporting route components from files inside the `routes` directory
- Defining routes in your `remix.config.js` file

Routes can also be defined in both places, and Remix will merge them to create all of your app's routes. [See our routing docs for more info.](../api/conventions)

---

Let's assume your app defines routes in `index.js` at the top of the rendering tree:

```js filename=index.js
import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import App from "./app";
import Dashboard from "./dashboard";
import Expenses from "./expenses";
import Invoices from "./invoices";
import UserLayout from "./user-layout";
import UserProfile from "./user-profile";
import UserSales from "./user-sales";

const root = createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />}>
        <Route index element={<Dashboard />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path=":userId" element={<UserLayout />}>
          <Route path="profile" element={<UserProfile />} />
          <Route path="sales" element={<UserSales />} />
        </Route>
      </Route>
    </Routes>
  </BrowserRouter>
);
```

In Remix, you never need to explicitly render the `<BrowserRouter />`, `<Routes />` or `<Route />`. This route hierachy can be replicated by:

- rendering the `App` component in special route file called `root.jsx` in your `appDirectory`
- moving the other route components into the `routes` directory
- updating file names to follow our [file name conventions](../api/conventions#file-name-conventions)

So you'll end up with a file structure that looks like this:

```
app/
├── routes/
│   ├── $userId/
│   │   ├── profile.jsx
│   │   ├── sales.jsx
│   └── expenses.jsx
│   └── index.jsx
│   └── invoices.jsx
│   └── $userId.jsx
└── root.jsx
```

### The `root` route

The root route (or the "root root" if you're Wes Bos) is responsible for providing the structure of the application. Its default export is a component that renders the full HTML tree.

The index HTML file in a CRA app may look something like this:

```html filename=index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="Web site created using create-react-app"
    />
    <link
      rel="apple-touch-icon"
      href="%PUBLIC_URL%/logo192.png"
    />
    <link
      rel="manifest"
      href="%PUBLIC_URL%/manifest.json"
    />
    <title>React App</title>
  </head>
  <body>
    <noscript
      >You need to enable JavaScript to run this
      app.</noscript
    >
    <div id="root"></div>
  </body>
</html>
```

If you haven't already, create a new file in your `appDirectory` called `root.jsx` and export a component that mirrors that structure:

```js filename=root.jsx
import * as React from "react";

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <meta name="theme-color" content="#000000" />
        <meta
          name="description"
          content="Web site created using create-react-app"
        />
        <link rel="apple-touch-icon" href="/logo192.png" />
        <link rel="manifest" href="/manifest.json" />
        <title>React App</title>
      </head>
      <body>
        <noscript>
          You need to enable JavaScript to run this app.
        </noscript>
        <div id="root"></div>
      </body>
    </html>
  );
}
```

Notice that we don't need to use `%PUBLIC_URL%` as our server serves relative paths from the `public` directory.

We can also get rid of the `noscript` tag because we're server rendering now, which means users who disable JavaScript will still be able to see our app and thanks to [progressive enahancement](../pages/philosophy#progressive-enhancement) most of the app will still work anyway.

And since we aren't mounting our app in the DOM on the client, we can replace `<div id="root"></div>` with our `<App />` component (assuming your `App` component renders an `<Outlet />` from React Router).

```jsx filename=root.jsx lines=[3,25]
import * as React from "react";

import App from "./app";

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <meta name="theme-color" content="#000000" />
        <meta
          name="description"
          content="Web site created using create-react-app"
        />
        <link rel="apple-touch-icon" href="/logo192.png" />
        <link rel="manifest" href="/manifest.json" />
        <title>React App</title>
      </head>
      <body>
        <App />
      </body>
    </html>
  );
}
```

<docs-warning><strong>Important:</strong> be sure to delete the `index.html` from your `public` directory after you've created your root route. Keeping the file around will cause your server to send that HTML instead of your Remix app when accessing the `/` route.</docs-warning>

### Route stylesheets

At this point, you _might_ be able to run your app with no changes, but you probably import a stylesheet somewhere in your `App` component (and probably from others, I'm sure). Remember though—Remix does not handle CSS imports the same way CRA does, and we think for good reason.

Assume you have a plain CSS import in your `App` component:

```jsx filename=app.jsx lines=[6]
import * as React from "react";
import { Outlet } from "react-router-dom";

import Logo from "./logo";
import SiteNav from "./site-nav";
import "./styles.css";

export default function App() {
  return (
    <div>
      <header>
        <Logo />
        <SiteNav />
      </header>
      <main>
        <Outlet />
      </main>
      <footer>&copy; Remix Software</footer>
    </div>
  );
}
```

While this is a convenient API, consider a few questions:

- How do the styles actually end up on the page? Do you get a `<link />` or an inline `<style />` in the `<head>`?
- If other components also import CSS, where do they end up in relation other component styles? This has important implications on how the styles are applied due to the cascading nature of CSS.
- As the styles are static assets, are we caching them? Can they be preloaded or lazy loaded?

The answer to all of these questions is up to CRA, not you. And if you want to know you'll have to dig around the CRA source code to know for sure.

We think there's a better way, and it's one that happens to be as old as HTML2: `<link rel="stylesheet" />`.

<docs-info>

**Note:** Remix does not currently support CSS processing directly. If you use preprocessors like Sass, Less, or PostCSS, you can run those as a separate process in development.

We also do not yet support CSS Modules, as that requires compiler integration and current approaches are not aligned with our design philosophy. We are actively working on a solution and plan to have an API for CSS Modules very soon.

</docs-info>

### Route `links` exports

In Remix, stylesheets can only be loaded from route component files. Importing them does not do anything magical with your styles, rather it returns a URL that can be used to load the stylesheet as you see fit. You can render the stylesheet directly in your component or use our `links` export.

Let's move our app's stylesheet and a few other assets to the `links` function in our root route:

```jsx filename=root.jsx lines=[2,5,7-16,32]
import * as React from "react";
import { Links } from "@remix-run/react";

import App from "./app";
import stylesheetUrl from "./styles.css";

export function links() {
  // `links` returns an array of objects whose
  // properties map to the `<link />` component props
  return [
    { rel: "icon", href: "/favicon.ico" },
    { rel: "apple-touch-icon", href: "/logo192.png" },
    { rel: "manifest", href: "/manifest.json" },
    { rel: "stylesheet", href: stylesheetUrl },
  ];
}

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <meta name="theme-color" content="#000000" />
        <meta
          name="description"
          content="Web site created using create-react-app"
        />
        <Links />
        <title>React App</title>
      </head>
      <body>
        <App />
      </body>
    </html>
  );
}
```

You'll notice on line 32 that we've rendered a `<Links />` component that replaced all of our individual `<link />` components. This is inconsequential if we only ever use links in the root route, but all child routes may export their own links that will also be rendered here. The `links` function can also return a [`PageLinkDescriptor` object](../api/conventions#pagelinkdescriptor) that allows you to prefetch the resources for a page the user is likely to navigate to.

If you currently inject `<link />` tags into your page client-side in your existing route components, either directly or via an abstraction like [`react-helmet`](https://www.npmjs.com/package/react-helmet), you can stop doing that and instead use the `links` export. You get to delete a lot of code and possibly a dependency or two!

### Route `meta` exports

Similar to `links`, each route can also export a `meta` function that—you guessed it—returns a value responsible for rendering `<meta />` tags for that route. This is useful because each route often has its own

The API is slightly different for `meta`. Instead of an array, it returns an object where the keys represent the meta `name` attribute (or `property` in the case of OpenGraph tags) and the value is the `content` attribute. The object can also accept a `title` property that renders a `<title />` component specifically for that route.

Again—no more weird dances to get meta into your routes from deep in the component tree. Export them at the route level and let the server handle it. ✨

## Using the `.jsx` extension for React component files

In CRA you can use JSX in either `.jsx` or `.js` files. You'll need to rename any components with JSX to `.jsx`.

## Updating imports and dev scripts

Remix re-exports everything you get from `react-router-dom` and we recommend that you update your imports to get those modules from `@remix-run/react`. In many cases, those components are wrapped with additional functionality and features specifically optimized for Remix.

**Before:**

```jsx bad
import { Link, Outlet } from "react-router-dom";
```

**After:**

```jsx
import { Link, Outlet } from "@remix-run/react";
```

You should also update a few scripts in your `package.json` to run Remix instead of `react-scripts`:

**After:**

```json
{
  "start": "react-scripts start",
  "dev": "react-scripts start",
  "build": "react-scripts build"
}
```

**After:**

```json
{
  "build": "remix build",
  "start": "cross-env NODE_ENV=production node ./server.js",
  "dev": "remix build && run-p dev:*",
  "dev:node": "cross-env NODE_ENV=development nodemon ./server.js --watch ./server.js",
  "dev:remix": "remix watch"
}
```

These scripts are a bit more verbose, but that's because we don't abstract the processes. We give that power back to you. After all, you know how to run your app better than anyone on our team!

## Final Thoughts

While we've done our best to provide a comprehensive migration guide, it's important to note that we built Remix from the ground up with a few key principles that differ significantly from how many React apps are currently built. While your app will likely run at this point, as you dig through our docs and explore our APIs, we think you'll be able to drastically reduce the complexity of your code and improve the end user experience of your app. It might take a bit of time to get there, but you can eat that elephant one bite at a time. 🐘

Now then, go off and Remix your CRA app. We think you'll like what you build along the way! 💿

### Further reading

- [Remix philosophy](../pages/philosophy)
- [Remix technical explanation](../pages/technical-explanation)
- [Data loading in Remix](./data-loading)
- [Routing in Remix](./routing)
- [Styling in Remix](./styling)
- [Frequently asked questions](../pages/faq)
- [Common "gotchas"](../pages/gotchas)
