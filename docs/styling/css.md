---
title: Regular CSS
---

# Regular CSS

Remix helps you scale an app with regular CSS with nested routes and [`links`][links].

CSS Maintenance issues can creep into a web app for a few reasons. It can get difficult to know:

- how and when to load CSS, so it was usually all loaded on every page
- if the class names and selectors you were using were accidentally styling other UI in the app
- if some rules weren't even used anymore as the CSS source code grew over time

Remix alleviates these issues with route-based stylesheets. Nested routes can each add their own stylesheets to the page and Remix will automatically prefetch, load, and unload them with the route. When the scope of concern is limited to just the active routes, the risks of these problems are reduced significantly. The only chances for conflicts are with the parent routes' styles (and even then, you will likely see the conflict since the parent route is also rendering).

<docs-warning>If you're using the [Classic Remix Compiler][classic-remix-compiler] rather than [Remix Vite][remix-vite], you should remove `?url` from the end of your CSS import paths.</docs-warning>

### Route Styles

Each route can add style links to the page, for example:

```tsx filename=app/routes/dashboard.tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import styles from "~/styles/dashboard.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];
```

```tsx filename=app/routes/dashboard.accounts.tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import styles from "~/styles/accounts.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];
```

```tsx filename=app/routes/dashboard.sales.tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import styles from "~/styles/sales.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];
```

Given these routes, this table shows which CSS will apply at specific URLs:

| URL                 | Stylesheets                    |
| ------------------- | ------------------------------ |
| /dashboard          | dashboard.css                  |
| /dashboard/accounts | dashboard.css<br/>accounts.css |
| /dashboard/sales    | dashboard.css<br/>sales.css    |

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

Perhaps you have a `<Button>` in `app/components/button/index.tsx` with styles at `app/components/button/styles.css` as well as a `<PrimaryButton>` that extends it.

Note that these are not routes, but they export `links` functions as if they were. We'll use this to surface their styles to the routes that use them.

```css filename=app/components/button/styles.css
[data-button] {
  border: solid 1px;
  background: white;
  color: #454545;
}
```

```tsx filename=app/components/button/index.tsx lines=[1,3,5-7]
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import styles from "./styles.css?url";

export const links: LinksFunction = () => [
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

```tsx filename=app/components/primary-button/index.tsx lines=[3,8,15]
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import { Button, links as buttonLinks } from "../button";

import styles from "./styles.css?url";

export const links: LinksFunction = () => [
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

Consider that `app/routes/_index.tsx` uses the primary button component:

```tsx filename=app/routes/_index.tsx lines=[3-6,10]
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import {
  PrimaryButton,
  links as primaryButtonLinks,
} from "~/components/primary-button";
import styles from "~/styles/index.css?url";

export const links: LinksFunction = () => [
  ...primaryButtonLinks(),
  { rel: "stylesheet", href: styles },
];
```

Now Remix can prefetch, load, and unload the styles for `button.css`, `primary-button.css`, and the route's `index.css`.

An initial reaction to this is that routes have to know more than you want them to. Keep in mind that each component must be imported already, so it's not introducing a new dependency, just some boilerplate to get the assets. For example, consider a product category page like this:

```tsx filename=app/routes/$category.tsx lines=[3-7]
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno

import { AddFavoriteButton } from "~/components/add-favorite-button";
import { ProductDetails } from "~/components/product-details";
import { ProductTile } from "~/components/product-tile";
import { TileGrid } from "~/components/tile-grid";
import styles from "~/styles/$category.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
];

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

```tsx filename=app/routes/$category.tsx
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
import styles from "~/styles/$category.css?url";

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
- Remix will prefetch the CSS for the remix page with [`<Link prefetch>`][link]
- When one component's styles change, browser and CDN caches for the other components won't break because they all have their own URLs.
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

import styles from "./styles.css?url";

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

Not only will this make the asset high priority in the network tab, but Remix will turn that `preload` into a `prefetch` when you link to the page with [`<Link prefetch>`][link], so the SVG background is prefetched, in parallel, with the remix route's data, modules, stylesheets, and any other preloads.

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

[links]: ../route/links
[custom-properties]: https://developer.mozilla.org/en-US/docs/Web/CSS/--*
[link]: ../components/link
[classic-remix-compiler]: ../guides/vite#classic-remix-compiler-vs-remix-vite
[remix-vite]: ../guides/vite
