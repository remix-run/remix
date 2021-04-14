---
title: Styling
---

There are a few popular ways to style your markup in the React community. The following have direct support in Remix:

- Remote Stylesheets
- Plain Stylesheets

While not built-in to Remix, you can use these also:

- PostCSS
- Tailwind
- CSS-in-JS libraries (that don't require babel)

Remix does not currently support CSS Modules. However, the Remix compiler uses [esbuild](https://esbuild.github.io) which will eventualy have direct support for them. When it supports them, Remix will.

The primary way to style in Remix is to add a `<link>` to the document when a route is active with [Route Module Links](../../api/app/route-module/) export.

## Remote Stylesheets

You can load stylesheets from any server, here's an example of loading a modern css reset from unpkg.

```ts
// root.tsx
import type { LinksFunction } from "@remix-run/react";

export let links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: "https://unpkg.com/modern-css-reset@1.4.0/dist/reset.min.css"
    }
  ];
};
```

## Stylesheets in the `app/` folder

Any stylesheets inside the `app` folder can be imported into your modules. Remix will:

1. Copy the file to your browser build directory
2. Fingerprint the file for long-term caching
3. Return the public URL to your module to be used while rendering

```ts
// root.tsx
import type { LinksFunction } from "@remix-run/react";
import styles from "./styles/app.css";

export let links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: styles }];
};
```

## PostCSS / Tailwind

While not built into Remix's compiler, it is straight forward to use PostCSS and Tailwind. The strategy is straight forward:

1. Use `postcss` cli directly alongside Remix
2. Buld CSS into the Remix app directory
3. Import your stylesheet to your modules like any other stylesheet

Here's a quick guide to getting it set up. We encourage you to read the official [Tailwind installation instructions](https://tailwindcss.com/docs/installation#installing-tailwind-css-as-a-post-css-plugin) as well.

1.  You'll to install them as dev dependencies in your app:

    ```sh
    npm install -D tailwindcss@latest postcss@latest autoprefixer@latest
    ```

2.  Add `postcss.config.js` in the Remix root.

    ```js filename=postcss.config.js
    module.exports = {
      plugins: {
        tailwindcss: {},
        autoprefixer: {}
      }
    };
    ```

3.  And one more config: `tailwind.config.js`:

    ```js filename=tailwind.config.js
    module.exports = {
      purge: [
        "./app/**/*.tsx",
        "./app/**/*.jsx",
        "./app/**/*.js",
        "./app/**/*.ts"
      ],
      darkMode: false, // or 'media' or 'class'
      theme: {
        extend: {}
      },
      variants: {},
      plugins: []
    };
    ```

4.  Add a css file to `./styles/app.css`

    ```css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    ```

5.  Add some scripts to your `package.json`

    ```json
    {
      "scripts": {
        "watch:css": "postcss styles --base styles --dir app/styles -w",
        "build:css": "postcss styles --base styles --dir app/styles --env production"
      }
    }
    ```

    These commands will process files from `./styles` into `./app/styles` where your Remix modules can import them.

    ```
    .
    ├── app
    │   └── styles (processed files)
    │       ├── app.css
    │       └── routes
    │           └── index.css
    └── styles (source files)
        ├── app.css
        └── routes
            └── index.css
    ```

    We recommend adding `/styles` to your `.gitignore`.

6.  Use it! When you're developing styles, open a terminal tab and run your new watch script:

    ```sh
    npm run css:watch
    ```

    When you're building for production, run

    ```sh
    npm run css:build
    ```

    Then import like any other css file:

    ```tsx filename=root.tsx
    import type { LinksFunction } from "@remix-run/react";
    import styles from "./styles/app.css";

    export let links: LinksFunction = () => {
      return [{ rel: "stylesheet", href: styles }];
    };
    ```

## CSS-in-JS libraries

You can use CSS-in-JS libraries like Styled Components, but you need to perform a "double render" in order to extract the styles from the component tree during the server render.

We don't recommend this approach for two reasons:

1. Styles are embedded into your HTML documents instead of cachable URLs. Browsers can't cache the styles shared between pages and HTML documents now must expire on your CDN with the styles inside of them.

2. It's a double render. Probably not a big deal, but it's just not needed.

We do recognize that CSS in JS solutions really shine for shared component systems.

Here's some sample code to show how you might use Styled Components with Remix:

1. First you'll need some context to put your styles on so that your root route can render them.

   ```tsx filename=app/StylesContext.tsx
   // app/StylesContext.tsx
   import { createContext } from "react";
   export default createContext<null | string>(null);
   ```

2. Your `entry.server.tsx` will look something like this:

   ```tsx filename=entry.server.tsx lines=6,7,16,20-26,29-30,35,37
   // app/entry.server.tsx
   import ReactDOMServer from "react-dom/server";
   import type { EntryContext } from "@remix-run/node";
   import { RemixServer } from "@remix-run/react";
   import { renderToString } from "react-dom/server";
   import { ServerStyleSheet } from "styled-components";
   import StylesContext from "./StylesContext";

   export default function handleRequest(
     request: Request,
     responseStatusCode: number,
     responseHeaders: Headers,
     remixContext: EntryContext
   ) {
     // set up the Styled Components sheet
     const sheet = new ServerStyleSheet();

     // This render is thrown away, it's here simply to let styled components
     // extract the styles used
     renderToString(
       sheet.collectStyles(
         <StylesContext.Provider value={null}>
           <RemixServer context={remixContext} url={request.url} />
         </StylesContext.Provider>
       )
     );

     // Now that we've rendered, we get the styles out of the sheet
     let styles = sheet.getStyleTags();
     sheet.seal();

     // Finally, we render a second time, but this time we have styles to apply,
     // make sure to pass them to `<StylesContext.Provider value>`
     let markup = ReactDOMServer.renderToString(
       <StylesContext.Provider value={styles}>
         <RemixServer context={remixContext} url={request.url} />
       </StylesContext.Provider>
     );

     return new Response("<!DOCTYPE html>" + markup, {
       status: responseStatusCode,
       headers: {
         ...Object.fromEntries(responseHeaders),
         "Content-Type": "text/html"
       }
     });
   }
   ```

3. Finally, access and render the styles in your root route.

   ```tsx filename=app/root.tsx lines=3,4,7,13
   // app/root.tsx
   import { Meta, Scripts } from "@remix-run/react";
   import { useContext } from "react";
   import StylesContext from "./StylesContext";

   export default function Root() {
     let styles = useContext(StylesContext);

     return (
       <html>
         <head>
           <Meta />
           {styles}
         </head>
         <body>
           <Scripts />
         </body>
       </html>
     );
   }
   ```
