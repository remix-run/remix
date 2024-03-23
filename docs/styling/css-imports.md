---
title: CSS Imports
---

# CSS Side Effect Imports

<docs-warning>This documentation is no longer relevant when using [Remix Vite][remix-vite]. CSS side effect imports work out of the box in Vite.</docs-warning>

Some NPM packages use side effect imports of plain CSS files (e.g. `import "./styles.css"`) to declare the CSS dependencies of JavaScript files. If you want to consume one of these packages, first ensure you've set up [CSS bundling][css-bundling] in your application.

For example, a module may have source code like this:

```tsx
import "./menu-button.css";

export function MenuButton() {
  return <button data-menu-button>{/* ... */}</button>;
}
```

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

[css-bundling]: ./bundling
[server-dependencies-to-bundle]: ../file-conventions/remix-config#serverdependenciestobundle
[remix-vite]: ../future/vite
