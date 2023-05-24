---
"@remix-run/dev": patch
---

Fix Tailwind performance issue when `postcss.config.js` contains `plugins: { tailwindcss: {} }` and `remix.config.js` contains both `tailwind: true` and `postcss: true`.

Note that this was _not_ an issue when the plugin function had been explicitly called, i.e. `plugins: [tailwindcss()]`. Remix avoids adding the Tailwind plugin to PostCSS if it's already present but we were failing to detect when the plugin function hadn't been called — either because the plugin function itself had been passed, i.e. `plugins: [require('tailwindcss')]`, or the plugin config object syntax had been used, i.e. `plugins: { tailwindcss: {} }`.
