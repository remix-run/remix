---
title: "@remix-run/react"
---

This package contains components and hooks for building the frontend of a Remix app with React.

## `Meta`, `Links`, `Scripts`, `Outlet`

These components are to be used once inside of your root route (`root.tsx`). They include everything Remix figured out or built in order for your page to render properly.

```tsx
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

```tsx
import React from "react";
import { useRouteData } from "@remix-run/react";

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

On client side page transitions, Remix is aware of the current version of your app. If you deployed in the middle of a user's session on your site, the next time they click a link it will be a full page transition (as if you used `<a>` instead of `<Link>`) and then the user gets the freshest version of your site.

If you've got any important state on the page when this happens, you're going to want to save it off somewhere like local storage, because a real page transition will blow it away.

Remix or not, this is just good practice to do anyway. The user can change the url, accidentally close the browser window, etc.

```tsx
import { useBeforeUnload } from "@remix-run/react";

function SomeForm() {
  let [state, setState] = React.useState(null);

  // save it off before the transition
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

The `<Form>` component is how to perform data mutations like creating, updating, and deleting data. While it might be a mindshift to think about these tasks as "navigation", it's how the web has handled mutations since before JavaScript was created!

For an in-depth look at mutations with form, check out the [Mutations]("../mutations") page.

### `<Form action>`

```js
<Form action="/projects/new" />
```

This tells the form which action to call. The `action` export of the matching data module will be called. In the above example, the action url would match a file at `data/routes/projects/new.ts`.

### `<Form method>`

```js
<Form method="post" />
```

This determins the [HTTP verb](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods) to be used: get, post, put, patch, delete. The default is "get".

Native `<form>` only supports get and post, so if you want your form to work with JavaScript on or off the page you'll need to stick with those two. Without JavaScript, Remix will turn non-get requests into "post", but you'll still need to instruct your server with a hidden input like `<input type="hidden" name="_method" method="delete" />`. If you always include JavaScript, you don't need to worry about this.

### `<Form encType>`

Defaults to `application/x-www-urlencoded`, which is also the only supported value right now. Before 1.0 we'll also support `multipart/form-data`.

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
    <form method="POST" onChange={handleChange}>
      {/* ... */}
    </form>
  );
}
```

This can also be useful if you'd like to automatically sign someone out of your website after a period of inactivity.

```tsx
import { useCallback, useEffect, useState } from "react";
import { useSubmit } from "@remix-run/react";

const oneMinute = 60_000;

function useSessionTimeout(initialTimeout) {
  let submit = useSubmit();
  let [sessionTimeout, setSessionTimeout] = useState(initialTimeout);

  let handleTimeout = useCallback(() => {
    submit(null, { method: "POST", action: "/logout" });
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
      <form method="POST" action="/logout">
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

```js
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

Returns the current route matches on the page:

```js
let matches = useMatches();
```

Matches has the following shape:

```js
[
  { pathname, data, params, handle }, // root route
  { pathname, data, params, handle }, // layout route
  { pathname, data, params, handle } // child route
  // etc.
];
```

Remix internally knows the all of the routes that match at the very top of the application hierachy even though routes down deeper fetched the data. It's how `<Meta />`, `<Links />`, and `<Scripts />` elements know what to render.

This hook allows you to create similar conventions, giving you access to all of the route matches and their data on the current page.

This is useful for creating things like data-driven breadcrumbs or any other kind of app convention. Before you can do that, you need a way for your route to export an api, or a "handle". Check out how we can create breadcrumbs in `root.tsx`.

First, your routes can put whatever they want on the `handle`, here we use `breadcrumb`, it's not a Remix thing, it's whatever you want.

```tsx
// routes/some-route.tsx
export let handle = {
  breadcrumb: () => <Link to="/some-route">Some Route</Link>
};
```

```tsx
// routes/some-route/some-child-route.tsx
export let handle = {
  breadcrumb: () => <Link to="/some-route/some-child-route">Child Route</Link>
};
```

And then we can use this in our root route:

```tsx
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
