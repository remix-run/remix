---
title: Styling
---

# Styling

The primary way to style in Remix (and the web) is to add a `<link rel="stylesheet">` to the page. In Remix, you can add these links via the [Route Module `links` export][route-module-links] at route layout boundaries. When the route is active, the stylesheet is added to the page. When the route is no longer active, the stylesheet is removed.

```js
export function links() {
  return [
    {
      rel: "stylesheet",
      href: "https://unpkg.com/modern-css-reset@1.4.0/dist/reset.min.css"
    }
  ];
}
```

Each nested route's `links` are merged (parents first) and rendered as `<link>` tags by the `<Links/>` you rendered in `app/root.js` in the head of the document.

```tsx filename=app/root.js lines=[1,7]
import { Links } from "remix";
// ...
export default function Root() {
  return (
    <html>
      <head>
        <Links />
        {/* ... */}
      </head>
      {/* ... */}
    </html>
  );
}
```

You can also import CSS files directly into your modules and Remix will:

1. Copy the file to your browser build directory
2. Fingerprint the file for long-term caching
3. Return the public URL to your module to be used while rendering

```tsx filename=app/root.tsx
// ...
import styles from "~/styles/global.css";
// styles is now something like /build/global-AE33KB2.css

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}
```

## CSS Ecosystem and Performance

<docs-info>We are still researching how best to support, and be supported by, the various styling libraries without sacrificing the user's network tab or creating a maintenance burden for Remix.</docs-info>

In today's ecosystem there are dozens of approaches and frameworks for styling. Remix supports many of them out of the box, but the frameworks that require direct integration with our compiler and expect Remix to automatically inject styles onto the page don't work right now.

We recognize that not being able to use your favorite CSS framework is a bummer. If yours isn't supported right now, we hope you'll find some of the approaches in this document equally as productive. We also recognize that supporting a variety of tools is critical for migration paths to Remix.

Here's some background on where we're at.

In general, stylesheets added to the page with `<link>` tend to provide the best user experience:

- The URL is cacheable in browsers and CDNs
- The URL can be shared across pages in the app
- The stylesheet can be loaded in parallel with the JavaScript bundles
- Remix can prefetch CSS assets when the user is about to visit a page with `<Link rel="prefetch">`.
- Changes to components don't break the cache for the styles
- Changes to the styles don't break the cache for the JavaScript

Therefore, CSS support in Remix boils down to one thing: it needs to create a CSS file you can add to the page with `<link rel="stylesheet">`. This seems like a reasonable request of a CSS framework--to generate a CSS file. Remix isn't against the frameworks that can't do this, it's just too early for us to add extension points to the compiler. Additionally, adding support directly inside of Remix is not tenable with the vast number of libraries out there.

Remix also supports "runtime" frameworks like styled components where styles are evaluated at runtime but don't require any kind of bundler integration--though we would prefer your stylesheets had a URL instead of being injected into style tags.

All this is to say that **we're still researching how best to integrate and work with the frameworks that require compiler integration**. With Remix's unique ability to prefetch, add, and remove CSS for partial UI on the page, we anticipate CSS frameworks will have some new ideas on how to support building actual CSS files to better support Remix and the performance of websites using them.

The two most popular approaches in the Remix community are route-based stylesheets and [Tailwind](https://tailwindcss.com). Both have exceptional performance characteristics. In this document we'll show how to use these two approaches as well as a few more.

## Regular Stylesheets

Remix makes writing plain CSS a viable option even for apps with a lot of UI. In our experience, writing plain CSS had maintenance issues for a few reasons. It was difficult to know:

- how and when to load CSS, so it was usually all loaded on every page
- if the class names and selectors you were using were accidentally styling other UI in the app
- if some rules were even used anymore as the CSS source code grew over time

Remix alleviates these issues with route-based stylesheets. Nested routes can each add their own stylesheets to the page and Remix will automatically prefetch, load, and unload them with the route. When the scope of concern is limited to just the active routes, the risks of these problems are reduced significantly. The only chances for conflicts are with the parent routes' styles (and even then, you will likely see the conflict since the parent route is also rendering).

### Route Styles

Each route can add style links to the page, for example:

```tsx filename=app/routes/dashboard.tsx
import styles from "~/styles/dashboard.css";

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}
```

```tsx filename=app/routes/dashboard/accounts.tsx
import styles from "~/styles/accounts.css";

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}
```

```tsx filename=routes/dashboard/sales.tsx
import styles from "~/styles/sales.css";

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}
```

Given these routes, this table shows which CSS will apply at specific URLs:

| URL                 | Stylesheets     |
| ------------------- | --------------- |
| /dashboard          | - dashboard.css |
|                     |                 |
| /dashboard/accounts | - dashboard.css |
|                     | - accounts.css  |
|                     |                 |
| /dashboard/sales    | - dashboard.css |
|                     | - sales.css     |

It's subtle, but this little feature removes a lot of the difficulty when styling your app with plain stylesheets.

### Shared Component Styles

Websites large and small usually have a set of shared components used throughout the rest of the app: buttons, form elements, layouts, etc. When using plain style sheets in Remix there are two approaches we recommend.

#### Shared stylesheet

The first approach is very simple. Put them all in a `shared.css` file included in `app/root.tsx`. That makes it easy for the components themselves to share CSS code (and your editor to provide intellisense for things like [custom properties][custom-properties]), and each component already needs a unique module name in JavaScript anyway, so you can scope the styles to a unique class name or data attribute:

```css filename=app/styles/shared.css
/* scope with class names */
.PrimaryButton {
  /* ... */
}

.TileGrid {
  /* ... */
}

/* or scope with data attributes to avoid concatenating
   className props, but it's really up to you */
[data-primary-button] {
  /* ... */
}

[data-tile-grid] {
  /* ... */
}
```

While this file may become large, it'll be at a single URL that will be shared by all routes in the app.

This also makes it easy for routes to adjust the styles of a component without needing to add an official new variant to the API of that component. You know it won't affect the component anywhere but the `/accounts` routes.

```css filename=app/styles/accounts.css
.PrimaryButton {
  background: blue;
}
```

#### Surfacing Styles

A second approach is to write individual css files per component and then "surface" the styles up to the routes that use them.

Perhaps you have a `<Button>` in `app/components/button/index.js` with styles at `app/components/button/styles.css` as well as a `<PrimaryButton>` that extends it.

Note that these are not routes, but they export `links` functions as if they were. We'll use this to surface their styles to the routes that use them.

```css filename=app/components/button/styles.css
[data-button] {
  border: solid 1px;
  background: white;
  color: #454545;
}
```

```tsx filename=app/components/button/index.js lines=[1,3-5]
import styles from "./styles.css";

export const links = () => [
  { rel: "stylesheet", href: styles }
];

export const Button = React.forwardRef(
  ({ children, ...props }, ref) => {
    return <button {...props} ref={ref} data-button />;
  }
);
```

And then a `<PrimaryButton>` that extends it:

```css filename=app/components/primary-button/styles.css
[data-primary-button] {
  background: blue;
  color: white;
}
```

```tsx filename=app/components/primary-button/index.js lines=[1,5,12]
import { Button, links as buttonLinks } from "../button";
import styles from "./styles.css";

export const links = () => [
  ...buttonLinks(),
  { rel: "stylesheet", href: styles }
];

export const PrimaryButton = React.forwardRef(
  ({ children, ...props }, ref) => {
    return (
      <Button {...props} ref={ref} data-primary-button />
    );
  }
);
```

Note that the primary button's `links` include the base button's links. This way consumers of `<PrimaryButton>` don't need to know its dependencies (just like JavaScript imports).

Because these buttons are not routes, and therefore not associated with a URL segment, Remix doesn't know when to prefetch, load, or unload the styles. We need to "surface" the links up to the routes that use the components.

Consider that `routes/index.js` uses the primary button component:

```tsx filename=app/routes/index.js lines=[2-5,9]
import styles from "~/styles/index.css";
import {
  PrimaryButton,
  links as primaryButtonLinks
} from "~/components/primary-button";

export function links() {
  return [
    ...primaryButtonLinks(),
    { rel: "stylesheet", href: styles }
  ];
}
```

Now Remix can prefetch, load, and unload the styles for `button.css`, `primary-button.css`, and the route's `index.css`.

An initial reaction to this is that routes have to know more than you want them to. Keep in mind each component must be imported already, so it's not introducing a new dependency, just some boilerplate to get the assets. For example, consider a product category page like this:

```tsx filename=app/routes/$category.js lines=[1-4,19-26]
import { TileGrid } from "~/components/tile-grid";
import { ProductTile } from "~/components/product-tile";
import { ProductDetails } from "~/components/product-details";
import { AddFavoriteButton } from "~/components/add-favorite-button";
import styles from "~/styles/$category.css";

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}

export async function loader({ params }) {
  return getProductsForCategory(params.category);
}

export default function Category() {
  const products = useLoaderData();
  return (
    <TileGrid>
      {products.map(product => (
        <ProductTile key={product.id}>
          <ProductDetails product={product} />
          <AddFavoriteButton id={product.id} />
        </ProductTile>
      ))}
    </TileGrid>
  );
}
```

The component imports are already there, we just need to surface the assets:

```js filename=app/routes/$category.js lines=[3,7,11,15,22-25]
import {
  TileGrid,
  links as tileGridLinks
} from "~/components/tile-grid";
import {
  ProductTile,
  links as productTileLinks
} from "~/components/product-tile";
import {
  ProductDetails,
  links as productDetailsLinks
} from "~/components/product-details";
import {
  AddFavoriteButton,
  links as addFavoriteLinks
} from "~/components/add-favorite-button";
import styles from "~/styles/$category.css";

export function links() {
  return [
    ...tileGridLinks(),
    ...productTileLinks(),
    ...productDetailsLinks(),
    ...addFavoriteLinks(),
    { rel: "stylesheet", href: styles }
  ];
}

// ...
```

While that's a bit of boilerplate it enables a lot:

- You control your network tab, and CSS dependencies are clear in the code
- Co-located styles with your components
- The only CSS ever loaded is the CSS that's used on the current page
- When your components aren't used by a route, their CSS is unloaded from the page
- Remix will prefetch the CSS for the next page with [`<Link prefetch>`][link]
- When one component's styles change, browser and CDN caches for the other components won't break because they are all have their own URLs.
- When a component's JavaScript changes but its styles don't, the cache is not broken for the styles

#### Asset Preloads

Since these are just `<link>` tags, you can do more than stylesheet links, like adding asset preloads for SVG icon backgrounds of your elements:

```css filename=app/components/copy-to-clipboard.css
[data-copy-to-clipboard] {
  background: url("/icons/clipboard.svg");
}
```

```tsx filename=app/components/copy-to-clipboard.jsx lines=[4-9]
import styles from "./styles.css";

export const links = () => [
  {
    rel: "preload",
    href: "/icons/clipboard.svg",
    as: "image",
    type: "image/svg+xml"
  },
  { rel: "stylesheet", href: styles }
];

export const CopyToClipboard = React.forwardRef(
  ({ children, ...props }, ref) => {
    return (
      <Button {...props} ref={ref} data-copy-to-clipboard />
    );
  }
);
```

Not only will this make the asset high priority in the network tab, but Remix will turn that `preload` into a `prefetch` when you link to the page with [`<Link prefetch>`][link], so the SVG background is prefetched, in parallel, with the next route's data, modules, stylesheets, and any other preloads.

### Link Media Queries

Using plain stylesheets and `<link>` tags also opens up the ability to decrease the amount of CSS your user's browser has to process when it paints the screen. Link tags support `media`, so you can do the following:

```tsx lines=[10,15,20]
export function links() {
  return [
    {
      rel: "stylesheet",
      href: mainStyles
    },
    {
      rel: "stylesheet",
      href: largeStyles,
      media: "(min-width: 1024px)"
    },
    {
      rel: "stylesheet",
      href: xlStyles,
      media: "(min-width: 1280px)"
    },
    {
      rel: "stylesheet",
      href: darkStyles,
      media: "(prefers-color-scheme: dark)"
    }
  ];
}
```

## Tailwind

Perhaps the most popular way to style a Remix application in the community is to use tailwind. It has the benefits of inline-style collocation for developer ergonomics and is able to generate a CSS file for Remix to import. The generated CSS file generally caps out around 8-10kb, even for large applications. Load that file into the `root.tsx` links and be done with it. If you don't have any CSS opinions, this is a great approach.

First install a couple dev dependencies:

```sh
npm add -D concurrently tailwindcss
```

Initialize a tailwind config so we can tell it which files to generate classes from.

```js filename=tailwind.config.js lines=[2,3]
module.exports = {
  content: ["./app/**/*.{ts,tsx,jsx,js}"],
  theme: {
    extend: {}
  },
  variants: {},
  plugins: []
};
```

Update the package scripts to generate the tailwind file during dev and for the production build

```json filename="package.json lines=[4-7]
{
  // ...
  "scripts": {
    "build": "npm run build:css && remix build",
    "build:css": "tailwindcss -o ./app/tailwind.css",
    "dev": "concurrently \"npm run dev:css\" \"remix dev\"",
    "dev:css": "tailwindcss -o ./app/tailwind.css --watch",
    "postinstall": "remix setup node",
    "start": "remix-serve build"
  }
  // ...
}
```

Finally, import the generated CSS file into your app:

```tsx filename=app/root.tsx
// ...
import styles from "./tailwind.css";

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}
```

If you want to use Tailwind's `@apply` method to extract custom classes, create a css file in the root directory, eg `./styles/tailwind.css`:

```css filename=styles/tailwind.css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .custom-class {
    @apply ...;
  }
}
```

Then alter how tailwind is generating css:

```json filename=package.json lines=[4-7]
{
  // ...
  "scripts": {
    "build": "npm run build:css && remix build",
    "build:css": "tailwindcss -i ./styles/tailwind.css -o ./app/tailwind.css --minify",
    "dev": "concurrently \"npm run dev:css\" \"remix dev\"",
    "dev:css": "tailwindcss -i ./styles/tailwind.css -o ./app/tailwind.css --watch",
    "postinstall": "remix setup node",
    "start": "remix-serve build"
  }
  // ...
}
```

This isn't required, but it's recommended to add the generated file to your gitignore list:

```sh lines=[5] filename=.gitignore
node_modules
/.cache
/build
/public/build
/app/tailwind.css
```

If you're using VSCode, it's recommended you install the [tailwind intellisense extension](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) for the best developer experience.

## Remote Stylesheets

You can load stylesheets from any server, here's an example of loading a modern css reset from unpkg.

```ts filename=app/root.tsx
import type { LinksFunction } from "remix";

export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: "https://unpkg.com/modern-css-reset@1.4.0/dist/reset.min.css"
    }
  ];
};
```

## PostCSS

While not built into Remix's compiler, it is straight forward to use PostCSS and add whatever syntax sugar you'd like to your stylesheets, here's the gist of it:

1. Use `postcss` cli directly alongside Remix
2. Build CSS into the Remix app directory from a styles source directory
3. Import your stylesheet to your modules like any other stylesheet

Here's how to set it up:

1. Install the dev dependencies in your app:

   ```sh
   npm install -D postcss-cli postcss autoprefixer
   ```

2. Add `postcss.config.js` in the Remix root.

   ```js filename=postcss.config.js
   module.exports = {
     plugins: {
       autoprefixer: {}
     }
   };
   ```

3. Add stylesheets to a `styles/` folder _next to `app/`_, we'll point postcss at this folder to build _into_ the `app/styles` folder next.

   ```sh
   mkdir styles
   touch styles/app.css
   ```

4. Add some scripts to your `package.json`

   ```json
   {
     "scripts": {
       "dev:css": "postcss styles --base styles --dir app/styles -w",
       "build:css": "postcss styles --base styles --dir app/styles --env production"
     }
   }
   ```

   These commands will process files from `./styles` into `./app/styles` where your Remix modules can import them.

   ```
   .
   ├── app
   │   └── styles (processed files)
   │       ├── app.css
   │       └── routes
   │           └── index.css
   └── styles (source files)
       ├── app.css
       └── routes
           └── index.css
   ```

   We recommend adding `app/styles` to your `.gitignore`.

5. Use it! When you're developing styles, open a terminal tab and run your new watch script:

   ```sh
   npm run dev:css
   ```

   When you're building for production, run

   ```sh
   npm run build:css
   ```

   Then import like any other css file:

   ```tsx filename=root.tsx
   import type { LinksFunction } from "remix";

   import styles from "./styles/app.css";

   export const links: LinksFunction = () => {
     return [{ rel: "stylesheet", href: styles }];
   };
   ```

You might want to use something like `concurrently` to avoid needing two terminal tabs to watch your CSS and run `remix dev`.

```sh
npm add -D concurrently
```

```json filename=package.json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:css\" \"remix dev\""
  }
}
```

## CSS Preprocessors

You can use CSS preprocessors like LESS and SASS. Doing so requires running an additional build process to convert these files to CSS files. This can be done via the command line tools provided by the preprocessor or any equivalent tool.

Once converted to CSS by the preprocessor, the generated CSS files can be imported into your components via the [Route Module `links` export]([route-module-links]) function, just like any other CSS file in Remix.

To ease development with CSS preprocessors you can add npm scripts to your `package.json` that generate CSS files from your SASS or LESS files. These scripts can be run in parallel alongside any other npm scripts that you run for developing a Remix application.

An example using SASS.

1. First you'll need to install the tool your preprocess uses to generate CSS files.

```sh
npm add -D sass
```

2. Add an npm script to your `package.json`'s `script` section' that uses the installed too to generate CSS files.

```json filename="package.json"
{
  // ...
  "scripts": {
    // ...
    "sass": "sass --watch app/:app/"
  }
  // ...
}
```

The above example assumes SASS files will be stored somewhere in the `app` folder.

The `--watch` flag included above will keep `sass` running as an active process, listening for changes to or for any new SASS files. When changes are made to the source file, `sass` will regenerate the CSS file automatically. Generated CSS files will be stored in the same location as their source files.

3. Run the npm script.

```sh
npm run sass
```

This will start the `sass` process. Any new SASS files, or changes to existing SASS files, will be detected by the running process.

You might want to use something like `concurrently` to avoid needing two terminal tabs to generate your CSS files and also run `remix dev`.

```sh
npm add -D concurrently
```

```json filename=package.json
{
  "scripts": {
    "dev": "concurrently \"npm run sass\" \"remix dev\""
  }
}
```

Running `npm run dev` will run the specified commands in parallel in a single terminal window.

## CSS-in-JS libraries

You can use CSS-in-JS libraries like Styled Components. Some of them require a "double render" in order to extract the styles from the component tree during the server render. It's unlikely this will affect performance in a significant way; React is pretty fast.

Here's some sample code to show how you might use Styled Components with Remix (you can also [find a runnable example in the Remix examples directory][styled-components-example]):

1. First you'll need to put a placeholder in your root component to control where the styles are inserted.

   ```tsx filename=app/root.tsx lines=[21-23]
   import {
     Links,
     LiveReload,
     Meta,
     Outlet,
     Scripts,
     ScrollRestoration
   } from "remix";

   export default function App() {
     return (
       <html lang="en">
         <head>
           <meta charSet="utf-8" />
           <meta
             name="viewport"
             content="width=device-width,initial-scale=1"
           />
           <Meta />
           <Links />
           {typeof document === "undefined"
             ? "__STYLES__"
             : null}
         </head>
         <body>
           <Outlet />
           <ScrollRestoration />
           <Scripts />
           {process.env.NODE_ENV === "development" ? (
             <LiveReload />
           ) : null}
         </body>
       </html>
     );
   }
   ```

2. Your `entry.server.tsx` will look something like this:

   ```tsx filename=entry.server.tsx lines=[4,12,15-20,22-23]
   import ReactDOMServer from "react-dom/server";
   import { RemixServer } from "remix";
   import type { EntryContext } from "remix";
   import { ServerStyleSheet } from "styled-components";

   export default function handleRequest(
     request: Request,
     responseStatusCode: number,
     responseHeaders: Headers,
     remixContext: EntryContext
   ) {
     const sheet = new ServerStyleSheet();

     let markup = ReactDOMServer.renderToString(
       sheet.collectStyles(
         <RemixServer
           context={remixContext}
           url={request.url}
         />
       )
     );
     const styles = sheet.getStyleTags();
     markup = markup.replace("__STYLES__", styles);

     responseHeaders.set("Content-Type", "text/html");

     return new Response("<!DOCTYPE html>" + markup, {
       status: responseStatusCode,
       headers: responseHeaders
     });
   }
   ```

Other CSS-in-JS libraries will have a similar setup. If you've got a CSS framework working well with Remix, please [contribute an example][examples]!

NOTE: You may run into hydration warnings when using Styled Components. Hopefully [this issue][styled-components-issue] will be fixed soon.

[custom-properties]: https://developer.mozilla.org/en-US/docs/Web/CSS/--*
[link]: ../api/remix#link
[route-module-links]: ../api/conventions#links
[styled-components-example]: https://github.com/remix-run/remix/tree/dev/examples/styled-components
[examples]: https://github.com/remix-run/remix/tree/dev/examples
[styled-components-issue]: https://github.com/styled-components/styled-components/issues/3660
