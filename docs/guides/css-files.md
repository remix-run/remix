---
title: CSS Files
---

# CSS Files

There are two main ways to manage CSS files in Remix:

- [CSS bundling](#css-bundling)
- [CSS URL imports](#css-url-imports)

This guide covers the pros and cons of each approach, and provides some recommendations based on your project's specific needs.

## CSS bundling

CSS bundling is the most common approach for managing CSS files in the React community. In this model, styles are treated as module side effects and are bundled into one or more CSS files at the discretion of the bundler. It's simpler to use, requires less boilerplate, and gives the bundler more power to optimize the output.

For example, let's say you have a basic `Button` component with some styles attached to it:

```css filename=components/Button.css
.Button__root {
  background: blue;
  color: white;
}
```

```jsx filename=components/Button.jsx
import "./Button.css";

export function Button(props) {
  return <button {...props} className="Button__root" />;
}
```

To use this component, you can simply import it and use it in your route file:

```jsx filename=routes/hello.jsx
import { Button } from "../components/Button";

export default function HelloRoute() {
  return <Button>Hello!</Button>;
}
```

When consuming this component, you don't have to worry about managing individual CSS files. CSS is treated as private implementation detail of the component. This is a common pattern in many component libraries and design systems and scales quite nicely.

#### CSS bundling is required for some CSS solutions

Some approaches to managing CSS files requires the use of bundled CSS.

For example, [CSS Modules][css-modules] is built on the assumption that CSS is bundled. Even though you're explicitly importing the CSS file's class names as a JavaScript object, the styles themselves are still treated as a side effect and automatically bundled into the output. You have no access to the underlying URL of the CSS file.

Another common use case where CSS bundling is required is when you're using a third-party component library that imports CSS files as side effects and relies on your bundler to handle them for you, such as [React Spectrum][react-spectrum].

#### CSS order can differ between development and production

CSS bundling comes with a notable trade-off when combined with Vite's approach to on-demand compilation.

Using the `Button.css` example presented earlier, this CSS file will be transformed into the following JavaScript code during development:

<!-- prettier-ignore-start -->

<!-- eslint-skip -->

```js
import {createHotContext as __vite__createHotContext} from "/@vite/client";
import.meta.hot = __vite__createHotContext("/app/components/Button.css");
import {updateStyle as __vite__updateStyle, removeStyle as __vite__removeStyle} from "/@vite/client";
const __vite__id = "/path/to/app/components/Button.css";
const __vite__css = ".Button__root{background:blue;color:white;}"
__vite__updateStyle(__vite__id, __vite__css);
import.meta.hot.accept();
import.meta.hot.prune(()=>__vite__removeStyle(__vite__id));
```

<!-- prettier-ignore-end -->

It's worth stressing that this transformation only happens in development. **Production builds won't look like this** since static CSS files are generated.

Vite does this so that CSS can be compiled lazily when imported and then hot reloaded during development. As soon as this file is imported, the CSS file's contents are injected into the page as a side effect.

The downside of this approach is that these styles are not tied to the route lifecycle. This means that styles won't be unmounted when navigating away from the route, leading to a build-up of old styles in the document while navigating around the app. This can result in CSS rule order differing between development and production.

To mitigate this, it's helpful to write your CSS in a way that makes it resilient against changes to file ordering. For example, you can use [CSS Modules][css-modules] to ensure that CSS files are scoped to the files that import them. You should also try to limit the number of CSS files that target a single element since the order of those files is not guaranteed.

#### Bundled CSS can disappear in development

Another notable tradeoff with Vite's approach to CSS bundling during development is that React can inadvertently remove styles from the document.

When React is used to render the entire document (as Remix does) you can run into issues when elements are dynamically injected into the `head` element. If the document is re-mounted, the existing `head` element is removed and replaced with an entirely new one, removing any `style` elements that Vite injects during development.

In Remix, this issue can happen due to hydration errors since it causes React to re-render the entire page from scratch. Hydration errors can be caused by your app code, but they can also be caused by browser extensions that manipulate the document.

This is a known React issue that is fixed in their [canary release channel][react-canaries]. If you understand the risks involved, you can pin your app to a specific [React version][react-versions] and then use [package overrides][package-overrides] to ensure this is the only version of React used throughout your project. For example:

```json filename=package.json
{
  "dependencies": {
    "react": "18.3.0-canary-...",
    "react-dom": "18.3.0-canary-..."
  },
  "overrides": {
    "react": "18.3.0-canary-...",
    "react-dom": "18.3.0-canary-..."
  }
}
```

<docs-info>For reference, this is how Next.js treats React versioning internally on your behalf, so this approach is more widely used than you might expect, even though it's not something Remix provides as a default.</docs-info>

Again, it's worth stressing that this issue with styles that were injected by Vite only happens in development. **Production builds won't have this issue** since static CSS files are generated.

## CSS URL Imports

The other main way to manage CSS files is to use [Vite's explicit URL imports][vite-url-imports].

Vite lets you append `?url` to your CSS file imports to get the URL of the file (e.g. `import href from "./styles.css?url"`). This URL can then be passed to Remix via the [links export][links-export] from route modules. This ties CSS files into Remix's routing lifecycle, ensuring styles are injected and removed from the document while navigating around the app.

For example, using the same `Button` component example from earlier, you can export a `links` array alongside the component so that consumers have access to its styles.

```jsx filename=components/Button.jsx lines=[1,3-5]
import buttonCssUrl from "./Button.css?url";

export const links = [
  { rel: "stylesheet", href: buttonCssUrl },
];

export function Button(props) {
  return <button {...props} className="Button__root" />;
}
```

When importing this component, consumers now also need to import this `links` array and attach it to their route's `links` export:

```jsx filename=routes/hello.jsx lines=[3,6]
import {
  Button,
  links as buttonLinks,
} from "../components/Button";

export const links = [...buttonLinks];

export default function HelloRoute() {
  return <Button>Hello!</Button>;
}
```

This approach is much more predictable in terms of rule ordering since it gives you granular control over each file and provides consistent behavior between development and production. As opposed to bundled CSS during development, styles are removed from the document when they are no longer needed. If the page's `head` element is ever re-mounted, any `link` tags defined by your routes will also be re-mounted since they are part of the React lifecycle.

The downside of this approach is that it can result in a lot of boilerplate.

If you have many re-usable components each with their own CSS file, you'll need to manually surface all `links` for each component up to your route components, which may require passing CSS URLs up through multiple levels of components. This can also error prone since it's easy to forget to import a component's `links` array.

Despite its advantages, you may find this to be too cumbersome compared to CSS bundling, or you may find the extra boilerplate to be worth it. There's no right or wrong on this one.

## Conclusion

It's ultimately personal preference when it comes to managing CSS files in your Remix application, but here's a good rule of thumb:

- If your project only has a small number of CSS files (e.g. when using Tailwind, in which case you might only have a single CSS file), you should use CSS URL imports. The increased boilerplate is minimal and your development environment will be much closer to production.
- If your project has a large number of CSS files tied to smaller re-usable components, you'll probably find the reduced boilerplate of CSS bundling to be much more ergonomic. Just be aware of the trade-offs and write your CSS in a way that makes it resilient against changes to file ordering.
- If you're experiencing issues with styles disappearing during development, you should consider using a [React canary release][react-canaries] so that React doesn't remove the existing `head` element when re-mounting the page.

[css-modules]: https://vitejs.dev/guide/features#css-modules
[react-spectrum]: https://react-spectrum.adobe.com
[react-canaries]: https://react.dev/blog/2023/05/03/react-canaries
[react-versions]: https://www.npmjs.com/package/react?activeTab=versions
[package-overrides]: https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides
[vite-url-imports]: https://vitejs.dev/guide/assets#explicit-url-imports
[links-export]: ../route/links
