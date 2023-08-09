---
"@remix-run/dev": major
---

Enable built-in PostCSS and Tailwind support by default.

These tools are now automatically used within the Remix compiler if PostCSS and/or Tailwind configuration files are present in your project.

If you have a custom PostCSS and/or Tailwind setup outside of Remix, you can disable these features in your `remix.config.js`.

```js
module.exports = {
  postcss: false,
  tailwind: false,
};
```
