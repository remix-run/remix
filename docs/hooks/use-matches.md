---
title: useMatches
toc: false
---

# `useMatches`

Returns the current route matches on the page. This is useful for creating layout abstractions with your current routes.

```tsx
function SomeComponent() {
  const matches = useMatches();

  // ...
}
```

`matches` has the following shape:

```ts
[
  { id, pathname, data, params, handle }, // root route
  { id, pathname, data, params, handle }, // layout route
  { id, pathname, data, params, handle }, // child route
  // etc.
];
```

Remix knows all of your route matches and data at the top of the React element tree. That's how we can:

- add meta tags to the top of the document even though they are defined in nested routes lower in the tree
- add `<link>` tags to assets at the top of the document even though ...
- add `<script>` bundles for each route at the top of the document ...

Pairing route `handle` with `useMatches`, you can build your own, similar conventions to Remix's built-in `<Meta>`, `<Links>`, and `<Scripts>` components.

Let's consider building some breadcrumbs. If a route wants to participate in these breadcrumbs at the top of the root layout, it normally can't because it renders down low in the tree.

You can put whatever you want on a route `handle`. Here we'll use `breadcrumb`. It's not a Remix thing, it's whatever you want. Here it's added to a parent route:

1. Add the breadcrumb handle to the parent route

   ```tsx filename=app/routes/parent.tsx
   export const handle = {
     breadcrumb: () => <Link to="/parent">Some Route</Link>,
   };
   ```

2. We can do the same for a child route

   ```tsx filename=app/routes/parent/child.tsx
   export const handle = {
     breadcrumb: () => (
       <Link to="/parent/child">Child Route</Link>
     ),
   };
   ```

3. Now we can put it all together in our root route with `useMatches`.

   ```tsx filename=root.tsx lines=[5,9,19-30]
   import {
     Links,
     Scripts,
     useLoaderData,
     useMatches,
   } from "@remix-run/react";

   export default function Root() {
     const matches = useMatches();

     return (
       <html lang="en">
         <head>
           <Links />
         </head>
         <body>
           <header>
             <ol>
               {matches
                 // skip routes that don't have a breadcrumb
                 .filter(
                   (match) =>
                     match.handle && match.handle.breadcrumb
                 )
                 // render breadcrumbs!
                 .map((match, index) => (
                   <li key={index}>
                     {match.handle.breadcrumb(match)}
                   </li>
                 ))}
             </ol>
           </header>

           <Outlet />
         </body>
       </html>
     );
   }
   ```

Notice that we're passing the `match` to breadcrumbs. We didn't use it, but we could have used `match.data` to use our route's data in the breadcrumb.

Another common use case is [enabling JavaScript for some routes and not others][disabling-javascript].

Once again, `useMatches` with `handle` is a great way for routes to participate in rendering abstractions at the top of element tree, above where the route is actually rendered.

For an example of how to share loader data via `useMatches`, check out [the sharing loader data example in the remix repo][example-sharing-loader-data].

[disabling-javascript]: ../guides/disabling-javascript
[example-sharing-loader-data]: https://github.com/remix-run/examples/tree/main/sharing-loader-data
