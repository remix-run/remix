---
title: Environment Variables
---

Remix does not do anything directly with environment variables, but there are some patterns we find useful that we'll share in this guide.

Environment Variables are values that live on the server that your application can use. You may be familiar with the ubiquitous `NODE_ENV`. Your deployment server probably automatically sets that to "production".

Here are some example environment variables you might find in the wild:

- `DATABASE_URL`: The URL for a Postgres Database
- `STRIPE_PRIVATE_KEY`: The key a checkout workflow will use on the server
- `STRIPE_PUBLIC_KEY`: The key a checkout workflow will use on the browser

## Server Environment Variables

Environment variables on your server will be handled by your host, for example:

- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Architect Environment Variables](https://arc.codes/docs/en/reference/cli/env)

If your host doesn't have any conventions here we recommend using [dotenv](https://www.npmjs.com/package/dotenv).

## Environment Variables for the Browser

We get a lot of customers asking if we can let them put environment variables into browser bundles. It's a common strategy in build-heavy frameworks.

However, this approach is a problem for a few reasons:

1. It's not really an environment variable. You have to know which server you're deploying to at build time.
2. You can't change the values without a rebuild and redeploy.
3. It's easy to accidentally leak secrets into publically accessible files!

Instead we recommmend keeping all of your environment variables on the server (all the server secrets as well as the stuff your JavaScript in the browser needs) and exposing them to your browser code through `window.ENV`.

1. **Return `ENV` for the client from the root loader** - Inside your loader you can access your server's environment variables. Loaders only run on the server and are never bundled into your client side JavaScript.

   ```tsx [3-6]
   export function loader() {
     return {
       ENV: {
         STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
         FAUNA_DB_URL: process.env.FAUNA_DB_URL
       }
     };
   }

   export function Root() {
     return (
       <html lang="en">
         <head>
           <Meta />
           <Links />
         </head>
         <body>
           <Outlet />
           <Scripts />
         </body>
       </html>
     );
   }
   ```

2. **Put `ENV` on window** - This is how we hand off the values from the server to the client. Make sure to put this before `<Scripts/>`

   ```tsx [11, 20-24]
   export function loader() {
     return {
       ENV: {
         STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
         FAUNA_DB_URL: process.env.FAUNA_DB_URL
       }
     };
   }

   export function Root() {
     let data = useRouteData();
     return (
       <html lang="en">
         <head>
           <Meta />
           <Links />
         </head>
         <body>
           <Outlet />
           <script
             dangerouslySetInnerHTML={{
               __html: `window.ENV = ${JSON.stringify(data.ENV)}`
             }}
           />
           <Scripts />
         </body>
       </html>
     );
   }
   ```

3. **Access the values**

   ```tsx [4]
   import { loadStripe } from "@stripe/stripe-js";

   export async function redirectToStripeCheckout(sessionId) {
     let stripe = await loadStripe(window.ENV.stripe);
     return stripe.redirectToCheckout({ sessionId });
   }
   ```
