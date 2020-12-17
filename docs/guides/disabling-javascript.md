---
title: Disabling JavaScript
---

Do you ever look at a page on your site and think "why are we loading all of this JavaScript? There's nothing on this page but links!" This may seem a little odd for a JavaScript framework, but you can easily turn off JavaScript with a boolean but your data loading and links will still all work.

## Editing App.js to Disable JavaScript

In the near future we'll have a more built in way to do this, but this works pretty well already. Edit your App.js file (or whichever file you render the `<Scripts/>` tag in) and add something like this:

```jsx
import React from "react";
import { Meta, Scripts, Styles, Routes } from "@remix-run/react";
import { useLocation } from "react-router-dom";

// set up the urls you don't want to serve JavaScript at all
let noScriptPaths = new Set(["/", "/buy", "/privacy", "/about"]);

export default function App() {
  let location = useLocation();
  // decide if you should include scripts
  let includeScripts = !noScriptPaths.has(location.pathname);

  // then use the flag to render scripts or not
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Styles />
      </head>
      <body className="bg-white text-gray-900">
        <Routes />
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

```jsx
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

There's little reason to load 100kb of JavaScript for one small interactive piece of a landing page. Watch this space, we have got PLANS.
