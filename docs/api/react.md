---
title: "@remix-run/react"
---

This package contains components and hooks for building the frontend of a Remix app with React.

## `Meta`, `Links`, `Scripts`, `Outlet`

These components are to be used once inside of your root route (`root.tsx`). They include everything Remix figured out or built in order for your page to render properly.

```tsx [2,10,11,14,15]
import React from "react";
import { Meta, Links, Scripts } from "@remix-run/react";
import { Outlet } from "react-router-dom";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
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

## `useRouteData`

This hook returns the data from your route data loader.

```tsx [2,9]
import React from "react";
import { useRouteData } from "@remix-run/react";

export function loader() {
  return { some: "data" };
}

export default function Invoices() {
  let invoices = useRouteData();
  // ...
}
```

`useRouteData` can be useful for creating abstractions that do some transformation on the data for your route. For example, with Firebase you could build a hook that turns the static data fetched from the server into a live document in the client.

```tsx
// if you're using firebase you could build a "live" route document
function useLiveRouteData() {
  // your server could return the path of the data it fetched, and the data on
  // two keys. If all routes loaders with live data follow this convention, it
  // doesn't matter which route we're using this hook in
  let { path, data } = useRouteData();

  // maybe you've got a firebase abstraction that takes a path to subscribe to
  // and initial data.
  let liveData = useFirestoreDoc(path, data);

  // return the live data
  return liveData;
}
```

## `usePendingLocation`

During a clientside route transition, Remix loads the resources for the next page before continuing the transition (because we're all sick of flickering spinners). But we also need some UI to acknowledge that they clicked a link. This is the purpose of this hook.

Whenever a transition is happening, this hook will return the pending (or next) location. when it's over, it will return `undefined`. With this information you can create a loading indication on the current page, a link, or even globally in your root.tsx.

This example fades the page out if the transition is taking longer than 300ms.

```tsx
import React from "react";
import { usePendingLocation, Meta, Links, Scripts } from "@remix-run/react";
import { Outlet } from "react-router-dom";

export default function App() {
  let pendingLocation = usePendingLocation();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Links />
      </head>
      <body
        style={{
          opacity: !!pendingLocation ? "0.15" : "1",
          transition: "opacity 500ms ease-in-out",
          transitionDelay: "300ms"
        }}
      >
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
```

## `useBeforeUnload`

This hook is just a helper around `window.onbeforeunload`.

When users click links to pages they haven't visited yet, Remix loads the code-split modules for that page. If you deploy in the middle of a user's session, and you or your host removes the old files from the server (many do 😭) then Remix's requests for those modules will fail. Remix recovers by automatically reloading the browser at the new URL. This should start over from the server with the latest version of your application. Most of the time this works out great and user doesn't even know anything happened.

In this situation, you may need to save important application state on the page (to something like the browser's local storage) because the automatic page reload will lose any state you had.

Remix or not, this is just good practice to do. The user can change the url, accidentally close the browser window, etc.

```tsx [1, 7-12]
import { useBeforeUnload } from "@remix-run/react";

function SomeForm() {
  let [state, setState] = React.useState(null);

  // save it off before the automatic page reload
  useBeforeUnload(
    React.useCallback(() => {
      localStorage.stuff = state
    }),
    [state]
  );

  // read it in when they return
  React.useEffect(() => {
    if (state === null && localStorage.stuff != null) {
      setState(localStorage.stuff);
    }
  }, []);

  return (
    // ...
  );
}
```

## `<Form>`

The `<Form>` component is a declarative way to perform data mutations: creating, updating, and deleting data. While it might be a mindshift to think about these tasks as "navigation", it's how the web has handled mutations since before JavaScript was created!

- Whether JavaScript is on the page or not, your data interactions created with `<Form>` and `action` will work.
- After a `<Form>` submit, all of the loaders on the page will be reloaded. This ensures that any updates to your data on the server are reflected with fresh fetches from your loaders.
- You can build "optimistic UI" and pending indicators with `usePendingFormSubmit`
- `<Form>` automatically serializes your form's values (identically to the browser when not using JavaScript)

```js
import { Form } from "@remix-run/react";

function HomePage() {
  return (
    <Form>
      <input type="text" name="title" />
    </Form>
  );
}
```

For an in-depth look at mutations with form, check out the [Mutations](../../guides/mutations/) page.

### `<Form action>`

The form action is optional. If omitted, the current route will handle the action. You may want to post to a different route.

```js
<Form action="/projects/new" />
```

This would call the action for a route found at `app/routes/projects/new.tsx`.

### `<Form method>`

This determines the [HTTP verb](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods) to be used: get, post, put, patch, delete. The default is "get".

```js
<Form method="post" />
```

Native `<form>` only supports get and post, so if you want your form to work with JavaScript on or off the page you'll need to stick with those two.

Without JavaScript, Remix will turn non-get requests into "post", but you'll still need to instruct your server with a hidden input like `<input type="hidden" name="_method" method="delete" />`. If you always include JavaScript, you don't need to worry about this.

### `<Form encType>`

Defaults to `application/x-www-urlencoded`, which is also the only supported value right now.

### `<Form replace>`

```tsx
<Form replace />
```

Instructs the form to replace the current entry in the history stack, instead of pushing the new entry. This is useful for small mutations of records inside a list view, like "delete" or "mark complete". Anything that isn't really a page navigation.

Note: has no effect without JavaScript on the page.

### `<Form forceRefresh>`

```tsx
<Form forceRefresh />
```

If true, it will submit the form with the browser instead of JavaScript, even if JavaScript is on the page.

## `useFormAction`

Resolves the value of a `<form action>` attribute using React Router's relative paths. This can be useful when computing the correct action for a `<button formAction>`, for example, when a `<button>` changes the action of its `<form>`.

```tsx
<button formAction={useFormAction("destroy")} formMethod="DELETE">
  Delete
</button>
```

## `useSubmit`

Returns the function that may be used to submit a `<form>` (or some raw `FormData`) to the server using the same process that `<Form>` uses internally `onSubmit`. If you're familiar with React Router's `useNavigate`, you can think about this as the same thing but for `<Form>` instead of `<Link>`.

This is useful whenever you need to programmatically submit a form. For example, you may wish to save a user preferences form whenever any field changes.

```tsx
import { useSubmit } from "@remix-run/react";

function UserPreferences() {
  let submit = useSubmit();

  function handleChange(event) {
    submit(event.currentTarget, { replace: true });
  }

  return (
    <form method="post" onChange={handleChange}>
      {/* ... */}
    </form>
  );
}
```

This can also be useful if you'd like to automatically sign someone out of your website after a period of inactivity.

```tsx [2,7,11]
import { useCallback, useEffect, useState } from "react";
import { useSubmit } from "@remix-run/react";

const oneMinute = 60_000;

function useSessionTimeout(initialTimeout) {
  let submit = useSubmit();
  let [sessionTimeout, setSessionTimeout] = useState(initialTimeout);

  let handleTimeout = useCallback(() => {
    submit(null, { method: "post", action: "/logout" });
  });

  useEffect(() => {
    let timer = setTimeout(handleTimeout, sessionTimeout);

    return () => {
      clearTimeout(timer);
    };
  }, [sessionTimeout]);

  return setSessionTimeout;
}

function AdminPage() {
  // User will be automatically signed out after 5 mins of inactivity.
  let setSessionTimeout = useSessionTimeout(5 * oneMinute);

  // TODO: Use `setSessionTimeout(n)` when there is some activity
  // on the page to reset the timer and extend the session.

  return (
    <div>
      {/* User can use this form sign sign out immediately */}
      <form method="post" action="/logout">
        <button>Sign out</button>
      </form>

      {/* ... */}
    </div>
  );
}
```

## `usePendingFormSubmit`

```js
import { usePendingFormSubmit } from "@remix-run/react";

// ...
let { method, encType, data } = usePendingFormSubmit();
```

Returns `{ method, encType, data }` that are currently being used to submit a `<Form>`. This is useful for showing a pending indicator, optimistic UI for some newly created/destroyed data.

When the form is no longer pending, this hook will return `undefined`.

Here's a quick example:

```js [1,4,6]
import { usePendingFormSubmit } from "@remix-run/react";

function SomeForm() {
  let pendingSubmit = usePendingFormSubmit();

  return pendingSubmit ? (
    <div>
      <h2>Creating...</h2>
      <p>Name: {pendingSubmit.data.get("name")}</p>
      <p>Description: {pendingSubmit.data.get("description")}</p>
    </div>
  ) : (
    <Form>
      <label>
        Name: <input type="text" name="name" />
      </label>
      <label>
        Description: <input type="text" name="description" />
      </label>
      <button type="submit">Submit</button>
    </Form>
  );
}
```

## `useMatches`

Returns the current route matches on the page. This is useful for creating layout abstractions with your current routes.

```js
let matches = useMatches();
```

`matches` has the following shape:

```js
[
  { pathname, data, params, handle }, // root route
  { pathname, data, params, handle }, // layout route
  { pathname, data, params, handle } // child route
  // etc.
];
```

Remix knows all of your route matches and data at the top of the React element tree. That's how we can:

- add meta tags to the top of the document even though they are defined in nested routes lower in the tree
- add `<link>` tags to assets at the top of the document even though ...
- add `<script>` bundles for each route at the top of the document ...

Pairing [route `handle`](../app/#handle) with `useMatches`, you can build your own, similar conventions to Remix's built-in `<Meta>`, `<Links>`, and `<Scripts>` components.

Let's consider building some breadcrumbs. If a route wants to participate in these breadcrumbs at the top of the root layout, it normally can't because it renders down low in the tree.

You can put whatever you want on a route `handle`, here we'll use `breadcrumb`, it's not a Remix thing, it's whatever you want. Here it's added to a parent route:

1. Add the breadcrumb handle to the parent route

   ```tsx
   // routes/parent.tsx
   export let handle = {
     breadcrumb: () => <Link to="/parent">Some Route</Link>
   };
   ```

2. We can do the same for a child route

   ```tsx
   // routes/parent/child.tsx
   export let handle = {
     breadcrumb: () => <Link to="/parent/child">Child Route</Link>
   };
   ```

3. Now we can put it all together in our root route with `useMatches`.

   ```tsx [5, 16-22]
   // root.tsx
   import { Links, Scripts, useRouteData, useMatches } from "@remix-run/react";

   export default function Root() {
     let matches = useMatches();

     return (
       <html lang="en">
         <head>
           <meta charSet="utf-8" />
           <Links />
         </head>
         <body>
           <header>
             <ol>
               {matches
                 // skip routes that don't have a breadcrumb
                 .filter(match => match.handle && match.handle.breadcrumb)
                 // render breadcrumbs!
                 .map((match, index) => (
                   <li key={index}>{match.handle.breadcrumb(match)}</li>
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

Another common use case is [enabling JavaScript for some routes and not others](../../guides/disabling-javascript/).

Once again, `useMatches` with `handle` is a great way for routes to participate in rendering abstractions at the top of element tree, above where the route is actually rendered.
