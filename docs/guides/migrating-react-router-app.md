---
title: Migrating your React Router App to Remix
description: Migrating your React Router app to Remix can be done all at once or in stages. This guide will walk you through an iterative approach to get your app running quickly.
---

<docs-info>If you want a TL;DR version along with a repo outlining a simplified migration, check out our <a href="https://github.com/kentcdodds/incremental-react-router-to-remix-upgrade-path">example React Router-to-Remix repo</a>.</docs-info>

# Migrating your React Router App to Remix

Millions of React applications deployed worldwide are powered by [React Router](https://reactrouter.com/). Chances are you've shipped a few of them! Because Remix is built on top of React Router, we have worked to make migration an easy process you can work through iteratively to avoid huge refactors.

If you aren't already using React Router, we think there are several compelling reasons to reconsider! History management, dynamic path matching, nested routing, and much more. Take a look at the [React Router docs](https://reactrouter.com/docs/en/v6/getting-started/concepts) and see all what we have to offer.

## Ensure your app uses React Router v6

If you are using an older version of React Router, the first step is to upgrade to v6. Check out the [migration guide from v5 to v6](https://reactrouter.com/docs/en/v6/upgrading/v5) and our [backwards compatibility package](https://www.npmjs.com/package/react-router-dom-v5-compat) to upgrade your app to v6 quickly and iteratively.

## Installing Remix

First, you'll need a few of our packages to build on Remix. Follow the instructions below, running all commands from the root of your project.

```shell
npm install @remix-run/react @remix-run/node @remix-run/serve
npm install -D @remix-run/dev
```

## Creating server and browser entrypoints

Most React Router apps run primarily in the browser. The server's only job is to send a single static HTML page while React Router manages the route-based views client-side. These apps generally have a browser entrypoint file like a root `index.js` that looks something like this:

```jsx filename=index.js
import * as ReactDOM from "react-dom";

import App from "./App";

ReactDOM.render(<App />, document.getElementById("app"));
```

Server-rendered React apps are a little different. The browser script is not rendering your app, but is "hydrating" the DOM provided by the server. Hydration is the process of mapping the elements in the DOM to their React component counterparts and setting up event listeners so that your app is interative.

Let's start by creating two new files:

- `app/entry.server.jsx` (or `entry.server.tsx`)
- `app/entry.client.jsx` (or `entry.client.tsx`)

<docs-info>All of your app code in Remix will live in an `app` directory by convention. If your existing app uses a directory with the same name, rename it to something like `src` or `old-app` to differentiate as we migrate to Remix.</docs-info>

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

## Creating The `root` route

We mentioned that Remix is built on top of React Router. Your app likely renders a `BrowserRouter` with your routes defined in JSX `Route` components. We don't need to do that in Remix, but more on that later. For now we need to provide the lowest level route our Remix app needs to work.

The root route (or the "root root" if you're Wes Bos) is responsible for providing the structure of the application. Its default export is a component that renders the full HTML tree that every other route loads and depends on. Think of it as the scaffold or shell of your app.

In a client-rendered app, you will have an index HTML file that includes the DOM node for mounting your React app. The root route will render markup that mirrors the structure of this file.

Create a new file called `root.jsx` (or `root.tsx`) in your `app` directory. The contents of that file will vary, but let's assume that your `index.html` looks something like this:

```html filename=index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="My beautiful React app"
    />
    <link rel="apple-touch-icon" href="/logo192.png" />
    <link rel="manifest" href="/manifest.json" />
    <title>My React App</title>
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

In your `root.jsx`, export a component that mirrors its structure:

```js filename=root.jsx
import { Outlet } from "@remix-run/react";

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
          content="My beautiful React app"
        />
        <link rel="apple-touch-icon" href="/logo192.png" />
        <link rel="manifest" href="/manifest.json" />
        <title>My React App</title>
      </head>
      <body>
        <div id="root">
          <Outlet />
        </div>
      </body>
    </html>
  );
}
```

Notice a few things here:

- We got rid of the `noscript` tag. We're server rendering now, which means users who disable JavaScript will still be able to see our app (and over time, as you make [a few tweaks to improve progressive enhancement](../pages/philosophy#progressive-enhancement), much of your app should still work).
- Inside of the root element we render an `Outlet` component from `@remix-run/react`. This is the same component that you would normally use to render your matched route in a React Router app; it serves the same function here, but it's adapter for the router in Remix.

<docs-warning><strong>Important:</strong> be sure to delete the `index.html` from your `public` directory after you've created your root route. Keeping the file around may cause your server to send that HTML instead of your Remix app when accessing the `/` route.</docs-warning>

## Adapting your existing app code

First, move the root of your existing React code into your `app` directory. So if your root app code lives in an `src` directory in the project root, it should now be in `app/src`.

We also suggest renaming this directory to make it clear that this is your old code so that, eventually, you can delete it after migrating all of its contents. The beauty of this approach is that you don't have to do it all at once for your app to run as usual. In our demo project we name this directory `old-app`.

Lastly, in your root `App` component (the one that would have been mounted to the `root` element), remove the `<BrowserRouter>` from React Router. Remix takes care of this for you without needing to render the provider directly.

## Creating a catch-all route

Remix needs routes beyond the root route to know what to render in `<Outlet />`. Fortunately you already render `<Route>` components in your app, and Remix can use those as you migrate to use our [routing conventions](./routing.md).

To start, create a new directory in `app` called `routes`. In that directory, create a file called `$.jsx`. This is called [a **catch-all route**](./routing#splats) and it will be useful to let your old app handle routes that you haven't moved into the `routes` directory yet.

Inside of your `$.jsx` file, all we need to do is export the code from our old root `App`:

```js filename=$.jsx
export { default } from "~/old-app/app";
```

## Replacing the bundler with Remix

Remix provides its own bundler and CLI tools for development and building your app. Chances are your app used something like Create React App to bootstrap, or perhaps you have a custom build set up with Webpack.

In your `package.json` file, update your scripts to use `remix` commands instead of your current build and dev scripts.

```json filename=package.json
{
  "scripts": {
    "build": "remix build",
    "dev": "remix dev",
    "start": "remix-serve build"
  }
}
```

And poof! Your app is now server-rendered and your build went from 90 seconds to 0.5 seconds ⚡

## Creating your routes

Over time you'll want to migrate the routes rendered by React Router's `<Route>` components into their own route files. The filenames and directory structure outlined in our [routing conventions](./routing.md) will guide this migration.

The default export in your route file is the component rendered in the `<Outlet />`. So if you have a route in your `App` that looks like this:

```jsx filename=app/old-app/app.jsx
function About() {
  return (
    <main>
      <h1>About us</h1>
      <PageContent />
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/about" element={<About />} />
    </Routes>
  );
}
```

Your route file should look like this:

```jsx filename=app/routes/about.jsx
export default function About() {
  return (
    <main>
      <h1>About us</h1>
      <PageContent />
    </main>
  );
}
```

Once you create this file, you can delete the `<Route>` component from your `App`. After all of your routes have been migrated you can delete `<Routes>` and ultimately all of the code in `old-app`.

## Gotchas and next steps

At this point you _might_ be able to say you are done with the initial migration. Congrats! However Remix does things a bit differently than your typical React app. If it didn't, why would we have bothered building it in the first place? 😅

### Unsafe browser references

A common pain-point in migrating a client-rendered codebase to a server-rendered one is that you may have references to browser APIs in code that runs on the server. A common example can be found when initializing values in state:

```jsx
function Count() {
  let [count, setCount] = React.useState(
    () => localStorage.getItem("count") || 0
  );

  React.useEffect(() => {
    localStorage.setItem("count", count);
  }, [count]);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

In this example, `localStorage` is used as a global store to persist some data across page reloads. We update `localStorage` with the current value of `count` in `useEffect`, which is perfectly safe because `useEffect` is only ever called in the browser! However initializing state based on `localStorage` is a problem, as this callback is executed on both the server and in the browser.

Your go-to solution may be to check for the `window` object and only run the callback in the browser. However this can lead to another problem, which is the dreaded [hydration mismatch](https://reactjs.org/docs/react-dom.html#hydrate). React relies on markup rendered by the server to be identical to what is rendered during client hydration. This ensures that `react-dom` knows how to match DOM elements with their corresponding React components so that it can attach event listeners and perform updates as state changes. So if local storage gives us a different value than whatever we initiate on the server, we'll have a new problem to deal with.

#### Client-only components

One potential solution here is using a different caching mechanism that can be used on the server and passed to the component via props passed from a route's [loader data](../api/conventions#loader). But if it isn't crucial for your app to render the component on the server, a simpler solution may be to skip rendering altogether on the server and wait until hydration is complete to render it in the browser.

```jsx
// We can safely track hydration in memory state
// outside of the component because it is only
// updated once after the version instance of
// `SomeComponent` has been hydrated. From there,
// the browser takes over rendering duties across
// route changes and we no longer need to worry
// about hydration mismatches until the page is
// reloaded and `isHydrating` is reset to true.
let isHydrating = true;

function SomeComponent() {
  let [isHydrated, setIsHydrated] = React.useState(
    !isHydrating
  );

  React.useEffect(() => {
    isHydrating = false;
    setIsHydrated(true);
  }, []);

  if (isHydrated) {
    return <Count />;
  } else {
    return <SomeFallbackComponent />;
  }
}
```

To simplify this solution, we recommend the using the [`ClientOnly` component](https://github.com/sergiodxa/remix-utils/blob/main/src/react/client-only.tsx) in the [`remix-utils`](https://www.npmjs.com/package/remix-utils) community package. An example of its usage can be found in the [`examples` directory of the Remix repo](https://github.com/remix-run/remix/blob/main/examples/client-only-components/app/routes/index.tsx).

### `React.lazy` and `React.Suspense`

If you are lazy-loading components with [`React.lazy`](https://reactjs.org/docs/code-splitting.html#reactlazy) and [`React.Suspense`](https://reactjs.org/docs/react-api.html#reactsuspense), you may run into issues depending on the version of React you are using. Until React 18, this would not work on the server as `React.Suspense` was originally implemented as a browser-only feature.

If you are using React 17, you have a few options:

- Upgrade to React 18
- Use the [client-only approach](#client-only-components) outlined above
- Use an alternative lazy-loading solution such as [Loadable Components](https://loadable-components.com/docs/loadable-vs-react-lazy/)
- Remove `React.lazy` and `React.Suspense` altogether

Keep in mind that Remix automatically handles code-splitting for all your routes that it manages, so as you move things into the `routes` directory you should rarely—if ever—need to use `React.lazy` manually.

### Configuration

Further configuration is optional, but the following may be helpful to optimize your development workflow.

#### `remix.config.js`

Every Remix app accepts a `remix.config.js` file in the project root. While its settings are optional, we recommend you include a few of them for clarity's sake. See the [docs on configuration](../api/conventions#remixconfigjs) for more information about all available options.

```js filename=remix.config.js
module.exports = {
  appDirectory: "app",
  ignoredRouteFiles: ["**/.*"],
  assetsBuildDirectory: "public/build",
};
```

#### `jsconfig.json` or `tsconfig.json`

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

### A note about non-standard imports

At this point, you _might_ be able to run your app with no changes. If you are using Create React App or a highly-configured Webpack app, you likely use `import` to include non-JavaScript modules like stylesheets and images.

Remix does not support most non-standard imports, and we think for good reason. Below is a non-exhaustive list of some of the differences you'll encounter in Remix, and how to refactor as you migrate.

#### Asset imports

Many bundlers use plugins to allow importing various assets like images and fonts. These typically come into your component as string representing the filepath of the asset.

```js
import logo from "./logo.png";

export function Logo() {
  return <img src={logo} alt="My logo" />;
}
```

In Remix, this works basically the same way. For assets like fonts that are loaded by a `<link>` element, you'll generally import these in a route module and include the filename in an object returned by a `links` function. [See our docs on route `links` for more information.](../api/conventions#links)

#### SVG imports

Create React App and some Webpack plugins allow you to import SVG files as a React component. This is a common use case for SVG files, but it's not supported by default in Remix.

```js bad nocopy
// This will not work in Remix!
import MyLogo from "./logo.svg";

export function Logo() {
  return <MyLogo />;
}
```

If you want to use SVG files as React components, you'll need to first create the components and import them directly. [React SVGR](https://react-svgr.com/) is a great toolset that can help you generate these components from the [command line](https://react-svgr.com/docs/cli/) or in an [online playground](https://react-svgr.com/playground/) if you prefer to copy and paste.

```svg filename=icon.svg
<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 20 20" fill="currentColor">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" />
</svg>
```

```jsx filename=icon.jsx good
export default function Icon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="icon"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z"
      />
    </svg>
  );
}
```

#### CSS imports

Create React App and many Webpack plugins support importing CSS in your components in many ways. While this is common practice in the React ecosystem, it's not supported the same way in Remix for a few different reasons. We'll discuss this in depth in the next section, but for now just know that you need to import your stylesheets in route modules. Importing stylesheets directly in non-route components is not currently supported.

[Read more about route styles and why Remix does things a bit differently.](#route-stylesheets)

### Route styles

Let's talk a bit more about styles. Remix does not handle CSS imports the same way your bundler likely does, and we think that's for a good reason.

Assume you have a plain CSS import in your `App` component:

```jsx filename=app.jsx lines=[5]
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

The answer to all of these questions is up to your bundler, _not you_. We think there's a better way, and it's one that happens to be as old as HTML2: `<link rel="stylesheet" />`.

<docs-info>

**Note:** Remix does not currently support CSS processing directly. If you use preprocessors like Sass, Less, or PostCSS, you can run those as a separate process in development.

We also do not yet support CSS Modules, as that requires compiler integration and current approaches are not aligned with our design philosophy. We are actively working on a solution and plan to have an API for CSS Modules very soon.

</docs-info>

### Route `links` exports

In Remix, stylesheets can only be loaded from route component files. Importing them does not do anything magical with your styles, rather it returns a URL that can be used to load the stylesheet as you see fit. You can render the stylesheet directly in your component or use our [`links` export](../api/conventions#links).

Let's move our app's stylesheet and a few other assets to the `links` function in our root route:

```jsx filename=root.jsx lines=[1,4,6-15,31]
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

### Rendering components in `<head>`

Just as a `<link>` is rendered inside your route component and ultimately rendered in your root `<Links />` component, your app may use some injection trickery to render additional components in the document `<head>`. Often this is done to change the document's `<title>` or `<meta>` tags.

Similar to `links`, each route can also export a `meta` function that—you guessed it—returns a value responsible for rendering `<meta>` tags for that route. This is useful because each route often has its own

The API is slightly different for `meta`. Instead of an array, it returns an object where the keys represent the meta `name` attribute (or `property` in the case of OpenGraph tags) and the value is the `content` attribute. The object can also accept a `title` property that renders a `<title />` component specifically for that route.

```jsx filename=app/routes/about.jsx lines=[1-10]
export function meta() {
  return {
    title: "About Us",
    "og:title": "About Us",
    description: "Doin hoodrat stuff with our friends",
    "og:description": "Doin hoodrat stuff with our friends",
    "og:image:url": "https://remix.run/og-image.png",
    "og:image:alt": "Just doin a bunch of hoodrat stuff",
  };
}

export default function About() {
  return (
    <main>
      <h1>About us</h1>
      <PageContent />
    </main>
  );
}
```

Again—no more weird dances to get meta into your routes from deep in the component tree. Export them at the route level and let the server handle it. ✨

### Updating imports

Remix re-exports everything you get from `react-router-dom` and we recommend that you update your imports to get those modules from `@remix-run/react`. In many cases, those components are wrapped with additional functionality and features specifically optimized for Remix.

**Before:**

```jsx bad nocopy
import { Link, Outlet } from "react-router-dom";
```

**After:**

```jsx good
import { Link, Outlet } from "@remix-run/react";
```

## Final Thoughts

While we've done our best to provide a comprehensive migration guide, it's important to note that we built Remix from the ground up with a few key principles that differ significantly from how many React apps are currently built. While your app will likely run at this point, as you dig through our docs and explore our APIs, we think you'll be able to drastically reduce the complexity of your code and improve the end user experience of your app. It might take a bit of time to get there, but you can eat that elephant one bite at a time.

Now then, go off and _remix your app_. We think you'll like what you build along the way! 💿

### Further reading

- [Remix philosophy](../pages/philosophy)
- [Remix technical explanation](../pages/technical-explanation)
- [Data loading in Remix](./data-loading)
- [Routing in Remix](./routing)
- [Styling in Remix](./styling)
- [Frequently asked questions](../pages/faq)
- [Common "gotchas"](../pages/gotchas)
