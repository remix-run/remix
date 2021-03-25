---
title: Styling
---

There are a few popular ways to style your markup in the React community, here is the current support in Remix:

- ✅ Remote Stylesheets
- ✅ Plain Stylesheets
- ✅ Preprocessed CSS with PostCSS
- ✅ Tailwind
- ✅ CSS-in-JS libraries like Styled components
- ⛔️ CSS Modules (we're not against them, just haven't added them)

The primary way to style in Remix is to add a `<link>` to the document when a route is active with the [Route Module Links](/dashboard/docs/route-module#links) export.

## Remote Stylesheets

You can load stylesheets from any server, here's an example of loading a modern css reset from unpkg.

```ts
// root.tsx
import type { LinksFunction } from "@remix-run/react";

export let links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: "https://unpkg.com/modern-css-reset@1.4.0/dist/reset.min.css"
    }
  ];
};
```

## Plain Stylesheets

For stylesheets you control, but don't want to process with PostCSS, use the `url:` import hint and `links`.

```ts
// root.tsx
import type { LinksFunction } from "@remix-run/react";
import styles from "url:./styles/app.css";

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};
```

## PostCSS

If you want to process a stylesheet with PostCSS, use the `css:` import hint.

First, you'll need a `postcss.config.js` file in the root of your remix app.

```js
// postcss.config.js
module.exports = {
  plugins: [require("autoprefixer"), require("cssnano")]
};
```

And then all CSS imports will be processed with your PostCSS config:

```ts
// root.tsx
import type { LinksFunction } from "@remix-run/react";
import styles from "css:./styles/app.css";

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};
```

## Tailwind

Remix has support for Tailwind through the built-in PostCSS support. You will need:

```js
// postcss.config.js
module.exports = {
  plugins: [require("autoprefixer"), require("tailwindcss")]
};
```

```js
// tailwind.config.js
module.exports = {
  purge: ["./app/**/*.tsx", "./app/**/*.js", "./app/**/*.mdx"],
  plugins: [],
  theme: {},
  variants: {}
};
```

We recommend putting all of your tailwind imports into a single css file like `styles/tailwind.css`:

```css
/* styles/tailwind.css */

/* purgecss start ignore */
@tailwind base;
@tailwind components;
/* purgecss end ignore */

@tailwind utilities;
@tailwind screens;
```

Tailwind, in development, is hundreds of thousands of lines long (in production it's usually less than 10kb). Making any changes to the file that imports the big pieces of tailwind will slow down your rebuilds significantly. By putting them in a single file that never really changes you avoid paying that price as often.

Any global styles you might change often can go in an `app.css` file, saving you lots of time by avoiding rebuilding the tailwind styles:

```css
/* styles/app.css */

body {
  font-family: "Times New Roman";
}

:focus:not(:focus-visible) {
  outline: none;
}
```

Now you can import these into your root route:

```tsx
// root.tsx
import type { LinksFunction } from "@remix-run/react";
import tailwind from "css:./styles/tailwind.css";
import styles from "css:./styles/app.css";

export let links: LinksFunction = () => {
  return [
    { rel: "stylesheet", href: tailwind },
    { rel: "stylesheet", href: styles }
  ];
};
```

## CSS-in-JS libraries

You can use CSS-in-JS libraries like Styled Components in Remix just fine, the only trick is server rendering and extracting the styles from render.

TODO: show a copy/paste example
