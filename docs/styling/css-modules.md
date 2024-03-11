---
title: CSS Modules
---

# CSS Modules

<docs-warning>This documentation is only relevant when using the [Classic Remix Compiler][classic-remix-compiler]. If you're using [Remix Vite][remix-vite], support for [CSS Modules is built into Vite][vite-css-modules].</docs-warning>

To use the built-in CSS Modules support, first ensure you've set up [CSS bundling][css-bundling] in your application.

You can then opt into [CSS Modules][css-modules] via the `.module.css` file name convention. For example:

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

[css-bundling]: ./bundling
[css-modules]: https://github.com/css-modules/css-modules
[classic-remix-compiler]: ../future/vite#classic-remix-compiler-vs-remix-vite
[remix-vite]: ../future/vite
[vite-css-modules]: https://vitejs.dev/guide/features#css-modules
