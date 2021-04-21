---
title: Disabling JavaScript
---

Do you ever look at a page on your site and think "why are we loading all of this JavaScript? There's nothing on this page but links!" This may seem a little odd for a JavaScript framework, but you can easily turn off JavaScript with a boolean but your data loading and links will still all work.

Here's how we like to do it:

## Add a `handle` to JavaScript Enabled Route Modules

Open up each route module you want to include JavaScript for and add this:

```js
export let handle = { hydrate: true };
```

Now open `root.tsx`, bring in `useMatches` and add this:

```tsx [2,6,8-9,21-22]
import React from "react";
import { Meta, Links, Scripts, useMatches } from "@remix-run/react";
import { Outlet } from "react-router-dom";

export default function App() {
  let matches = useMatches();

  // If at least one route wants to hydrate, this will return true
  let includeScripts = matches.some(match => match.handle?.hydrate);

  // then use the flag to render scripts or not
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        {/* include the scripts, or not! */}
        {includeScripts && <Scripts />}
      </body>
    </html>
  );
}
```

All of your data loading will still work on the server render, and all of your `<Link>`s render normal `<a>` underneath, so they will continue to work.

On any page, at anytime, you can flip between plain HTML and full clientside transitions.

## I need tiny bit of JavaScript though.

If you need one tiny bit of interactivity, use a `<script dangerouslySetInnerHTML>`.

```tsx
<select id="qty">
  <option>1</option>
  <option>2</option>
  <option value="contact">Contact Sales for more</option>
</select>
<script
  dangerouslySetInnerHTML={{
    __html: `
      document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('qty').onchange = (event) => {
          if (event.target.value === "contact") {
            window.location.assign("/contact")
          }
        }
      });
    `,
  }}
/>
```

There's little reason to load 100kb of JavaScript for one small interactive piece of a landing page.
