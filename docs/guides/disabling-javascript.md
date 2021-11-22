---
title: Disabling JavaScript
toc: false
---

# Disabling JavaScript

Do you ever look at a page on your site and think "why are we loading all of this JavaScript? There's nothing on this page but links!" This may seem a little odd for a JavaScript framework, but you can easily turn off JavaScript with a boolean and your data loading, links, and even forms will still work.

Here's how we like to do it:

Open up each route module you want to include JavaScript for and add a "handle". This is way for you to provide any kind of meta information about a route to the parent route (as you'll see in a moment).

```js
export let handle = { hydrate: true };
```

Now open `root.tsx`, bring in `useMatches` and add this:

```tsx [7,11,14-16,29]
import React from "react";
import {
  Meta,
  Links,
  Scripts,
  Outlet,
  useMatches
} from "remix";

export default function App() {
  let matches = useMatches();

  // If at least one route wants to hydrate, this will return true
  let includeScripts = matches.some(
    match => match.handle?.hydrate
  );

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
