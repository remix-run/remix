---
title: "@remix-run/react"
---

This module is only to be used inside your app/ folder, not in your loaders/. It contains module for use inside of the React layer.

## `Meta`, `Styles`, `Routes`, `Script`

These components are to be used once inside of your global application layout. They include everything Remix figured out or built in order for your page to render properly.

```jsx
import React from "react";
import { Meta, Scripts, Styles, Routes } from "@remix-run/react";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Styles />
      </head>
      <body>
        <Routes />
        <Scripts />
      </body>
    </html>
  );
}
```

## `useGlobalData`

This hook returns the data loaded from your `loaders/global.js` file. It is not intended to be a "global data store", it's simply a root loader for any serverside information you need to fetch for your primary layout.

```jsx
import React from "react";
import { useGlobalData, Meta, Scripts, Styles, Routes } from "@remix-run/react";

export default function App() {
  let globalData = useGlobalData();

  return (
    <html lang={globalData.lang}>
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Styles />
      </head>
      <body>
        <Routes />
        <Scripts />
      </body>
    </html>
  );
}
```

## `useRouteData`

This hook returns the data from your route data loader.

```jsx
import React from "react";
import { useRouteData } from "@remix-run/react";

export default function Invoices() {
  let invoices = useRouteData();
  // ...
}
```

Note that the data is already passed to your component as a prop, so this hook is more useful for creating abstractions with hooks.

```jsx
import React from "react";
import { useRouteData } from "@remix-run/react";

export default function Invoices({ data: invoices }) {
  // don't need the hook
}
```

For example, with firebase you could build a hook that turns the static data fetched from the server into a live document in the client:

```jsx
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

## useLocationPending

Removed, use `usePendingLocation`

## usePendingLocation

During a clientside route transition, Remix loads the resources for the next page before continuing the transition (because we're all sick of flickering spinners). But we also need some UI to acknowledge that they clicked a link. This is the purpose of this hook.

Whenever a transition is happening, this hook will return the pending (or next) location. when it's over, it will return `undefined`. With this information you can create a loading indication on the current page, a link, or even globally in your App.js.

This example fades the page out if the transition is taking longer than 300ms.

```jsx
import React from "react";
import {
  usePendingLocation,
  Meta,
  Scripts,
  Styles,
  Routes
} from "@remix-run/react";

export default function App() {
  let pendingLocation = usePendingLocation();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <Meta />
        <Styles />
      </head>
      <body
        style={{
          opacity: !!pendingLocation ? "0.15" : "1",
          transition: "opacity 500ms ease-in-out",
          transitionDelay: "300ms"
        }}
      >
        <Routes />
        <Scripts />
      </body>
    </html>
  );
}
```

### useBeforeUnload

This hook is just a helper around `window.onbeforeunload`.

On client side page transitions, Remix is aware of the current version of your app. If you deployed in the middle of a user's session on your site, the next time they click a link it will be a full page transition (as if you used `<a>` instead of `<Link>`) and then the user gets the freshest version of your site.

If you've got any important state on the page when this happens, you're going to want to save it off somewhere like local storage, because a real page transition will blow it away.

Remix or not, this is just good practice to do anyway. The user can change the url, accidentally close the browser window, etc.

```jsx
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
  )
}
```

## `<Form>`

```js
import { Form } from "@remix-run/react";

//
<Form>
  <input type="text" name="title" />
</Form>;
```

The `<Form>` component is how to perform data mutations like creating, updating, and deleting data. While it might be a mindshift to think about these tasks as "navigation", it's how the web has handled mutations since before JavaScript was created!

For an in-depth look at mutations with form, check out the <Link to="../mutations">Mutations</Link> page.

### Form `action` prop

```js
<Form action="/projects/new" />
```

This tells the form which action to call. The `action` export of the matching data module will be called. In the above example, the action url would match a file at `data/routes/projects/new.ts`.

### Form `method` prop

```js
<Form method="post" />
```

This determins the [HTTP verb](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods) to be used: get, post, put, patch, delete. The default is "get".

Native `<form>` only supports get and post, so if you want your form to work with JavaScript on or off the page you'll need to stick with those two. Without JavaScript, Remix will turn non-get requests into "post", but you'll still need to instruct your server with a hidden input like `<input type="hidden" name="_method" method="delete" />`. If you always include JavaScript, you don't need to worry about this.

### Form `encType` prop

Defaults to `application/x-www-urlencoded`, which is also the only supported value right now. Before 1.0 we'll also support `multipart/form-data`.

### Form `replace` prop

```js
<Form replace />
```

Instructs the form to replace the current entry in the history stack, instead of pushing the new entry. This is useful for small mutations of records inside a list view, like "delete" or "mark complete". Anything that isn't really a page navigation.

Note: has no effect without JavaScript on the page.

### Form `forceRefresh` prop

```js
<Form forceRefresh />
```

If true, it will submit the form with the browser instead of JavaScript, even if JavaScript is on the page.

## `usePendingFormSubmit`

```js
import { usePendingFormSubmit } from "@remix-run/react";

// ...
let { method, data } = usePendingFormSubmit();
```

Returns `{ method, data }` that are currently being used to submit a `<Form>`. This is useful for showing a pending indicator, optimistic UI for some newly created/destroyed data.

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
