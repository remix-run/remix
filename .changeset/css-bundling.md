---
"@remix-run/dev": minor
"@remix-run/react": minor
"@remix-run/server-runtime": minor
"@remix-run/testing": minor
---

Enable support for [CSS Modules](https://github.com/css-modules/css-modules), [Vanilla Extract](http://vanilla-extract.style) and CSS side-effect imports

These CSS bundling features were previously only available via `future.unstable_cssModules`, `future.unstable_vanillaExtract` and `future.unstable_cssSideEffectImports` options in `remix.config.js`, but they have now been stabilized.

**CSS Bundle Setup**

In order to use these features, you first need to set up CSS bundling in your project. First install the `@remix-run/css-bundle` package.
  
```sh
npm i @remix-run/css-bundle
```

Then return the exported `cssBundleHref` as a stylesheet link descriptor from the `links` function at the root of your app.

```tsx
import type { LinksFunction } from "@remix-run/node"; // or cloudflare/deno
import { cssBundleHref } from "@remix-run/css-bundle";

export const links: LinksFunction = () => {
  return [
    ...(cssBundleHref
      ? [{ rel: "stylesheet", href: cssBundleHref }]
      : []),
    // ...
  ];
};
```

**CSS Modules**

To use [CSS Modules](https://github.com/css-modules/css-modules), you can opt in via the `.module.css` file name convention. For example:

```css
.root {
  border: solid 1px;
  background: white;
  color: #454545;
}
```

```tsx
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

**Vanilla Extract**

To use [Vanilla Extract](http://vanilla-extract.style), first install its `css` package as a dev dependency.

```sh
npm install -D @vanilla-extract/css
```

You can then opt in via the `.css.ts`/`.css.js` file name convention. For example:

```ts
import { style } from "@vanilla-extract/css";

export const root = style({
  border: "solid 1px",
  background: "white",
  color: "#454545",
});
```

```tsx
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

**CSS Side-Effect Imports**

Any CSS files that are imported as side-effects (e.g. `import "./styles.css"`) will be automatically included in the CSS bundle.

Since JavaScript runtimes don't support importing CSS in this way, you'll also need to add any packages using CSS side-effect imports to the [`serverDependenciesToBundle`](https://remix.run/docs/en/main/file-conventions/remix-config#serverdependenciestobundle) option in your `remix.config.js` file. This ensures that any CSS imports are compiled out of your code before running it on the server. For example, to use [React Spectrum](https://react-spectrum.adobe.com/react-spectrum/index.html):

```js filename=remix.config.js
// remix.config.js
module.exports = {
  serverDependenciesToBundle: [
    /^@adobe\/react-spectrum/,
    /^@react-spectrum/,
    /^@spectrum-icons/,
  ],
  // ...
};
```
