---
title: Styling
new: true
---

# Styling

The primary way to style in Remix (and the web) is to add a `<link rel="stylesheet">` to the page. In Remix, you can add these links via the [Route Module `links` export][route-module-links] at route layout boundaries. When the route is active, the stylesheet is added to the page. When the route is no longer active, the stylesheet is removed.

```tsx
export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: "https://unpkg.com/modern-css-reset@1.4.0/dist/reset.min.css",
    },
  ];
};
```

Each nested route's `links` are merged (parents first) and rendered as `<link>` tags by the `<Links/>` you rendered in `app/root.js` in the head of the document.

```tsx filename=app/root.js lines=[1,7]
import { Links } from "@remix-run/react";
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

Remix also has built-in support for the following:

- [Tailwind][tailwind-2]
- [PostCSS][post-css]
- [CSS Modules][css-modules]
- [Vanilla Extract][vanilla-extract-3]
- [CSS side-effect imports][css-side-effect-imports-2]

## CSS Ecosystem and Performance

In general, stylesheets added to the page with `<link>` tend to provide the best user experience:

- The URL is cacheable in browsers and CDNs
- The URL can be shared across pages in the app
- The stylesheet can be loaded in parallel with the JavaScript bundles
- Remix can prefetch CSS assets when the user is about to visit a page with `<Link rel="prefetch">`.
- Changes to components don't break the cache for the styles
- Changes to the styles don't break the cache for the JavaScript

Remix also supports "runtime" frameworks like styled components where styles are evaluated at runtime but don't require any kind of bundler integration--though we would prefer your stylesheets had a URL instead of being injected into style tags.

The two most popular approaches in the Remix community are route-based stylesheets and [Tailwind][tailwind]. Both have exceptional performance characteristics. In this document, we'll show how to use these two approaches as well as a few more.

## Regular Stylesheets

Remix makes writing plain CSS a viable option even for apps with a lot of UI. In our experience, writing plain CSS had maintenance issues for a few reasons. It was difficult to know:

- how and when to load CSS, so it was usually all loaded on every page
- if the class names and selectors you were using were accidentally styling other UI in the app
- if some rules weren't even used anymore as the CSS source code grew over time

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

```tsx filename=app/routes/dashboard/sales.tsx
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
  { rel: "stylesheet", href: styles },
];

export const Button = React.forwardRef(
  ({ children, ...props }, ref) => {
    return <button {...props} ref={ref} data-button />;
  }
);
Button.displayName = "Button";
```

And then a `<PrimaryButton>` that extends it:

```css filename=app/components/primary-button/styles.css
[data-primary-button] {
  background: blue;
  color: white;
}
```

```tsx filename=app/components/primary-button/index.js lines=[1,6,13]
import { Button, links as buttonLinks } from "../button";

import styles from "./styles.css";

export const links = () => [
  ...buttonLinks(),
  { rel: "stylesheet", href: styles },
];

export const PrimaryButton = React.forwardRef(
  ({ children, ...props }, ref) => {
    return (
      <Button {...props} ref={ref} data-primary-button />
    );
  }
);
PrimaryButton.displayName = "PrimaryButton";
```

Note that the primary button's `links` include the base button's links. This way consumers of `<PrimaryButton>` don't need to know its dependencies (just like JavaScript imports).

Because these buttons are not routes, and therefore not associated with a URL segment, Remix doesn't know when to prefetch, load, or unload the styles. We need to "surface" the links up to the routes that use the components.

Consider that `routes/index.js` uses the primary button component:

```tsx filename=app/routes/index.js lines=[1-4,9]
import {
  PrimaryButton,
  links as primaryButtonLinks,
} from "~/components/primary-button";
import styles from "~/styles/index.css";

export function links() {
  return [
    ...primaryButtonLinks(),
    { rel: "stylesheet", href: styles },
  ];
}
```

Now Remix can prefetch, load, and unload the styles for `button.css`, `primary-button.css`, and the route's `index.css`.

An initial reaction to this is that routes have to know more than you want them to. Keep in mind that each component must be imported already, so it's not introducing a new dependency, just some boilerplate to get the assets. For example, consider a product category page like this:

```tsx filename=app/routes/$category.js lines=[5-9,25-32]
import type { LoaderArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";

import { AddFavoriteButton } from "~/components/add-favorite-button";
import { ProductDetails } from "~/components/product-details";
import { ProductTile } from "~/components/product-tile";
import { TileGrid } from "~/components/tile-grid";
import styles from "~/styles/$category.css";

export function links() {
  return [{ rel: "stylesheet", href: styles }];
}

export async function loader({ params }: LoaderArgs) {
  return json(
    await getProductsForCategory(params.category)
  );
}

export default function Category() {
  const products = useLoaderData<typeof loader>();
  return (
    <TileGrid>
      {products.map((product) => (
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

```tsx filename=app/routes/$category.tsx lines=[5,9,13,17,24-27]
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import {
  AddFavoriteButton,
  links as addFavoriteLinks,
} from "~/components/add-favorite-button";
import {
  ProductDetails,
  links as productDetailsLinks,
} from "~/components/product-details";
import {
  ProductTile,
  links as productTileLinks,
} from "~/components/product-tile";
import {
  TileGrid,
  links as tileGridLinks,
} from "~/components/tile-grid";
import styles from "~/styles/$category.css";

export const links: LinksFunction = () => {
  return [
    ...tileGridLinks(),
    ...productTileLinks(),
    ...productDetailsLinks(),
    ...addFavoriteLinks(),
    { rel: "stylesheet", href: styles },
  ];
};

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

```tsx filename=app/components/copy-to-clipboard.tsx lines=[6-11]
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import styles from "./styles.css";

export const links: LinksFunction = () => [
  {
    rel: "preload",
    href: "/icons/clipboard.svg",
    as: "image",
    type: "image/svg+xml",
  },
  { rel: "stylesheet", href: styles },
];

export const CopyToClipboard = React.forwardRef(
  ({ children, ...props }, ref) => {
    return (
      <Button {...props} ref={ref} data-copy-to-clipboard />
    );
  }
);
CopyToClipboard.displayName = "CopyToClipboard";
```

Not only will this make the asset high priority in the network tab, but Remix will turn that `preload` into a `prefetch` when you link to the page with [`<Link prefetch>`][link], so the SVG background is prefetched, in parallel, with the next route's data, modules, stylesheets, and any other preloads.

### Link Media Queries

Using plain stylesheets and `<link>` tags also opens up the ability to decrease the amount of CSS your user's browser has to process when it paints the screen. Link tags support `media`, so you can do the following:

```tsx lines=[10,15,20]
export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: mainStyles,
    },
    {
      rel: "stylesheet",
      href: largeStyles,
      media: "(min-width: 1024px)",
    },
    {
      rel: "stylesheet",
      href: xlStyles,
      media: "(min-width: 1280px)",
    },
    {
      rel: "stylesheet",
      href: darkStyles,
      media: "(prefers-color-scheme: dark)",
    },
  ];
};
```

## Tailwind CSS

Perhaps the most popular way to style a Remix application in the community is to use [Tailwind CSS][tailwind]. It has the benefits of inline-style collocation for developer ergonomics and is able to generate a CSS file for Remix to import. The generated CSS file generally caps out around 8-10kb, even for large applications. Load that file into the `root.tsx` links and be done with it. If you don't have any CSS opinions, this is a great approach.

To use the built-in Tailwind support, first enable the `tailwind` option in `remix.config.js`:

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  tailwind: true,
  // ...
};
```

Install Tailwind as a dev dependency:

```sh
npm install -D tailwindcss
```

Then initialize a config file:

```sh
npx tailwindcss init --ts
```

Now we can tell it which files to generate classes from:

```ts filename=tailwind.config.ts lines=[4]
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

Then include the `@tailwind` directives in your CSS. For example, you could create a `tailwind.css` file at the root of your app:

```css filename=app/tailwind.css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Then add `tailwind.css` to your root route's `links` function:

```tsx filename=app/root.tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

// ...

import styles from "./tailwind.css";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];
```

With this setup in place, you can also use [Tailwind's functions and directives][tailwind-functions-and-directives] anywhere in your CSS. Note that Tailwind will warn that no utility classes were detected in your source files if you never used it before.

If you're also using Remix's [built-in PostCSS support][built-in-post-css-support], the Tailwind PostCSS plugin will be automatically included if it's missing, but you can also choose to manually include the Tailwind plugin in your PostCSS config instead if you prefer.

If you're using VS Code, it's recommended you install the [Tailwind IntelliSense extension][tailwind-intelli-sense-extension] for the best developer experience.

<docs-warning>It's recommended that you avoid Tailwind's `@import` syntax (e.g. `@import 'tailwindcss/base'`) in favor of Tailwind directives (e.g. `@tailwind base`). Tailwind replaces its import statements with inlined CSS but this can result in the interleaving of styles and import statements. This clashes with the restriction that all import statements must be at the start of the file. Alternatively, you can use [PostCSS][built-in-post-css-support] with the [postcss-import] plugin to process imports before passing them to esbuild.</docs-warning>

## Remote Stylesheets

You can load stylesheets from any server, here's an example of loading a modern css reset from unpkg.

```ts filename=app/root.tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: "https://unpkg.com/modern-css-reset@1.4.0/dist/reset.min.css",
    },
  ];
};
```

## PostCSS

[PostCSS][postcss] is a popular tool with a rich plugin ecosystem, commonly used to prefix CSS for older browsers, transpile future CSS syntax, inline images, lint your styles and more. When a PostCSS config is detected, Remix will automatically run PostCSS across all CSS in your project.

For example, to use [Autoprefixer][autoprefixer], first enable the `postcss` option in `remix.config.js`:

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  postcss: true,
  // ...
};
```

Install the PostCSS plugin.

```sh
npm install -D autoprefixer
```

Then add `postcss.config.js` in the Remix root referencing the plugin.

```js filename=postcss.config.js
module.exports = {
  plugins: {
    autoprefixer: {},
  },
};
```

If you're using [Vanilla Extract][vanilla-extract-2], since it's already playing the role of CSS preprocessor, you may want to apply a different set of PostCSS plugins relative to other styles. To support this, you can export a function from `postcss.config.js` which is given a context object that lets you know when Remix is processing a Vanilla Extract file.

```js filename=postcss.config.js
module.exports = (ctx) => {
  return ctx.remix?.vanillaExtract
    ? {
        // PostCSS plugins for Vanilla Extract styles...
      }
    : {
        // PostCSS plugins for other styles...
      };
};
```

## CSS Preprocessors

You can use CSS preprocessors like LESS and SASS. Doing so requires running an additional build process to convert these files to CSS files. This can be done via the command line tools provided by the preprocessor or any equivalent tool.

Once converted to CSS by the preprocessor, the generated CSS files can be imported into your components via the [Route Module `links` export][route-module-links] function, or included via [side-effect imports][css-side-effect-imports] when using [CSS bundling][css-bundling], just like any other CSS file in Remix.

To ease development with CSS preprocessors you can add npm scripts to your `package.json` that generate CSS files from your SASS or LESS files. These scripts can be run in parallel alongside any other npm scripts that you run for developing a Remix application.

An example using SASS.

1. First you'll need to install the tool your preprocess uses to generate CSS files.

```sh
npm add -D sass
```

2. Add an npm script to your `package.json`'s `script` section' that uses the installed tool to generate CSS files.

```json filename=package.json
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

You can use CSS-in-JS libraries like Styled Components and Emotion. Some of them require a "double render" in order to extract the styles from the component tree during the server render. It's unlikely this will affect performance in a significant way; React is pretty fast.

Since each library is integrated differently, check out our [examples repo][examples] to see how to use some of the most popular CSS-in-JS libraries. If you've got a library working well that hasn't been covered, please [contribute an example][examples]!

## CSS Bundling

<docs-warning>When using CSS-bundling features, you should avoid using `export *` due to an [issue with esbuild's CSS tree shaking][esbuild-css-tree-shaking-issue].</docs-warning>

Many common approaches to CSS within the React community are only possible when bundling CSS, meaning that the CSS files you write during development are collected into a separate bundle as part of the build process.

When using CSS-bundling features, the Remix compiler will generate a single CSS file containing all bundled styles in your application. Note that any [regular stylesheet imports][regular-stylesheet-imports] will remain as separate files.

Unlike many other tools in the React ecosystem, we do not insert the CSS bundle into the page automatically. Instead, we ensure that you always have control over the link tags on your page. This lets you decide where the CSS file is loaded relative to other stylesheets in your app.

To get access to the CSS bundle, first install the `@remix-run/css-bundle` package.

```sh
npm install @remix-run/css-bundle
```

Then, import `cssBundleHref` and add it to a link descriptor—most likely in `root.tsx` so that it applies to your entire application.

```tsx filename=root.tsx lines=[1,6-8]
import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

export const links: LinksFunction = () => {
  return [
    ...(cssBundleHref
      ? [{ rel: "stylesheet", href: cssBundleHref }]
      : []),
    // ...
  ];
};
```

With this link tag inserted into the page, you're now ready to start using the various CSS bundling features built into Remix.

### CSS Modules

To use the built-in CSS Modules support, first ensure you've set up [CSS bundling][css-bundling] in your application.

You can then opt into [CSS Modules] via the `.module.css` file name convention. For example:

```css filename=app/components/button/styles.module.css
.root {
  border: solid 1px;
  background: white;
  color: #454545;
}
```

```tsx filename=app/components/button/index.js lines=[1,9]
import styles from "./styles.module.css";

export const Button = React.forwardRef(
  ({ children, ...props }, ref) => {
    return (
      <button
        {...props}
        ref={ref}
        className={styles.root}
      />
    );
  }
);
Button.displayName = "Button";
```

### Vanilla Extract

[Vanilla Extract][vanilla-extract] is a zero-runtime CSS-in-TypeScript (or JavaScript) library that lets you use TypeScript as your CSS preprocessor. Styles are written in separate `*.css.ts` (or `*.css.js`) files and all code within them is executed during the build process rather than in your user's browser. If you want to keep your CSS bundle size to a minimum, Vanilla Extract also provides an official library called [Sprinkles][sprinkles] that lets you define a custom set of utility classes and a type-safe function for accessing them at runtime.

To use the built-in Vanilla Extract support, first ensure you've set up [CSS bundling][css-bundling] in your application.

Then, install Vanilla Extract's core styling package as a dev dependency.

```sh
npm install -D @vanilla-extract/css
```

You can then opt into Vanilla Extract via the `.css.ts`/`.css.js` file name convention. For example:

```ts filename=app/components/button/styles.css.ts
import { style } from "@vanilla-extract/css";

export const root = style({
  border: "solid 1px",
  background: "white",
  color: "#454545",
});
```

```tsx filename=app/components/button/index.js lines=[1,9]
import * as styles from "./styles.css"; // Note that `.ts` is omitted here

export const Button = React.forwardRef(
  ({ children, ...props }, ref) => {
    return (
      <button
        {...props}
        ref={ref}
        className={styles.root}
      />
    );
  }
);
Button.displayName = "Button";
```

### CSS Side-Effect Imports

Some NPM packages use side-effect imports of plain CSS files (e.g. `import "./styles.css"`) to declare the CSS dependencies of JavaScript files. If you want to consume one of these packages, first ensure you've set up [CSS bundling][css-bundling] in your application.

Since JavaScript runtimes don't support importing CSS in this way, you'll need to add any relevant packages to the [`serverDependenciesToBundle`][server-dependencies-to-bundle] option in your `remix.config.js` file. This ensures that any CSS imports are compiled out of your code before running it on the server. For example, to use React Spectrum:

```js filename=remix.config.js
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  serverDependenciesToBundle: [
    /^@adobe\/react-spectrum/,
    /^@react-spectrum/,
    /^@spectrum-icons/,
  ],
  // ...
};
```

[custom-properties]: https://developer.mozilla.org/en-US/docs/Web/CSS/--*
[link]: ../components/link
[route-module-links]: ../route/links
[examples]: https://github.com/remix-run/examples
[tailwind]: https://tailwindcss.com
[tailwind-functions-and-directives]: https://tailwindcss.com/docs/functions-and-directives
[tailwind-intelli-sense-extension]: https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss
[postcss]: https://postcss.org
[autoprefixer]: https://github.com/postcss/autoprefixer
[postcss-preset-env]: https://preset-env.cssdb.org
[esbuild-css-tree-shaking-issue]: https://github.com/evanw/esbuild/issues/1370
[css modules]: https://github.com/css-modules/css-modules
[regular-stylesheet-imports]: #regular-stylesheets
[server-dependencies-to-bundle]: ../file-conventions/remix-config#serverdependenciestobundle
[css-bundling]: #css-bundling
[vanilla-extract]: https://vanilla-extract.style
[sprinkles]: https://vanilla-extract.style/documentation/packages/sprinkles
[built-in-post-css-support]: #postcss
[vanilla-extract-2]: #vanilla-extract
[css-side-effect-imports]: #css-side-effect-imports
[tailwind-2]: #tailwind-css
[post-css]: #postcss
[css-modules]: #css-modules
[vanilla-extract-3]: #vanilla-extract
[css-side-effect-imports-2]: #css-side-effect-imports
[postcss-import]: https://github.com/postcss/postcss-import
