---
title: Remix package
order: 2
---

This package provides all the components, hooks, and [Web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) objects and helpers.

# Components and Hooks

## `Meta`, `Links`, `Scripts`, `Outlet`

These components are to be used once inside of your root route (`root.tsx`). They include everything Remix figured out or built in order for your page to render properly.

```tsx [2,10,11,14,15]
import React from "react";
import { Meta, Links, Scripts } from "remix";
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
import { useRouteData } from "remix";

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
import { usePendingLocation, Meta, Links, Scripts } from "remix";
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
import { useBeforeUnload } from "remix";

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
import { Form } from "remix";

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
import { useSubmit } from "remix";

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
import { useSubmit } from "remix";

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
import { usePendingFormSubmit } from "remix";

// ...
let { method, encType, data } = usePendingFormSubmit();
```

Returns `{ method, encType, data }` that are currently being used to submit a `<Form>`. This is useful for showing a pending indicator, optimistic UI for some newly created/destroyed data.

When the form is no longer pending, this hook will return `undefined`.

Here's a quick example:

```js [1,4,6]
import { usePendingFormSubmit } from "remix";

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
   import { Links, Scripts, useRouteData, useMatches } from "remix";

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

# HTTP Helpers

## `json`

This is a shortcut for creating `application/json` responses. It assumes you are using `utf-8` encoding.

```ts [2,6]
import type { LoaderFunction } from "remix";
import { json } from "remix";

export let loader: LoaderFunction = () => {
  // So you can write this:
  return json({ any: "thing" });

  // Instead of this:
  return new Response(JSON.stringify({ any: "thing" }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
};
```

You can also pass a status code and headers:

```ts [4-9]
export let loader: LoaderFunction = () => {
  return json(
    { not: "coffee" },
    {
      status: 418,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
};
```

## `redirect`

This is shortcut for sending 30x responses.

```ts [2,8]
import type { ActionFunction } from "remix";
import { redirect } from "remix";

export let action: ActionFunction = () => {
  let userSession = await getUserSessionOrWhatever();

  if (!userSession) {
    return redirect("/login");
  }

  return json({ ok: true });
};
```

By default it sends 302, but you can change it to whichever redirect status code you'd like:

```ts
redirect(path, 301);
redirect(path, 303);
```

You can also send a `ResponseInit` to set headers, like committing a session.

```ts
redirect(path, {
  headers: {
    "Set-Cookie": await commitSession(session)
  }
});

redirect(path, {
  status: 302,
  headers: {
    "Set-Cookie": await commitSession(session)
  }
});
```

Of course, you can do redirects without this helper if you'd rather build it up yourself:

```ts
// this is a shortcut...
return redirect("/else/where", 303);

// ...for this
return new Response("", {
  status: 303,
  headers: {
    Location: "/else/where"
  }
});
```

# Cookies

A [cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) is a small piece of information that your server sends someone in a HTTP response that their browser will send back on subsequent requests. This technique is a fundamental building block of many interactive websites that adds state so you can build authentication (see [sessions](#sessions)), shopping carts, user preferences, and many other features that require remembering who is "logged in".

Remix's `Cookie` interface provides a logical, reusable container for cookie metadata.

## Using cookies

While you may create these cookies manually, it is more common to use a [session storage](#sessions).

In Remix, you will typically work with cookies in your `loader` and/or `action` functions (see <Link to="../mutations">mutations</Link>) since those are the places where you need to read and write data.

Let's say you have a banner on your e-commerce site that prompts users to check out the items you currently have on sale. The banner spans the top of your homepage, and includes a button on the side that allows the user to dismiss the banner so they don't see it for at least another week.

First, create a cookie:

```js
// app/cookies.js
import { createCookie } from "remix";

export let userPrefs = createCookie("user-prefs", {
  maxAge: 604_800 // one week
});
```

Then, you can `import` the cookie and use it in your `loader` and/or `action`. The `loader` in this case just checks the value of the user preference so you can use it in your component for deciding whether or not to render the banner. When the button is clicked, the `<form>` calls the `action` on the server and reloads the page without the banner.

**Note:** We recommend (for now) that you create all the cookies your app needs in `app/cookies.js` and `import` them into your route modules. This allows the Remix compiler to correctly prune these imports out of the browser build where they are not needed. We hope to eventually remove this caveat.

```js
// app/routes/index.js
import React from "react";
import { useRouteData, json, redirect } from "remix";

import { userPrefs as cookie } from "../cookies";

export function loader({ request }) {
  let value = cookie.parse(request.headers.get("Cookie")) || {};
  let showBanner = "showBanner" in value ? value.showBanner : true;
  return { showBanner };
}

export async function action({ request }) {
  let value = cookie.parse(request.headers.get("Cookie")) || {};
  let bodyParams = new URLSearchParams(await request.text());

  if (bodyParams.get("bannerVisibility") === "hidden") {
    value.showBanner = false;
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": cookie.serialize(value)
    }
  });
}

export default function Home() {
  let { showBanner } = useRouteData();

  return (
    <div>
      {showBanner && (
        <div>
          <span>
            <Link to="../sale">Don't miss our sale!</Link>
          </span>
          <form method="POST">
            <button name="bannerVisibility" value="hidden">
              Hide
            </button>
          </form>
        </div>
      )}
      <h1>Welcome!</h1>
    </div>
  );
}
```

## Cookie attributes

Cookies have [several attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes) that control when they expire, how they are accessed, and where they are sent. Any of these attributes may be specified either in `createCookie(name, options)`, or during `serialize()` when the `Set-Cookie` header is generated.

```js
let cookie = createCookie("user-prefs", {
  // These are defaults for this cookie.
  domain: "remix.run",
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: true,
  expires: new Date(Date.now() + 60),
  maxAge: 60
});

// You can either use the defaults:
cookie.serialize(userPrefs);

// Or override individual ones as needed:
cookie.serialize(userPrefs, { sameSite: "strict" });
```

Please read [more info about these attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes) to get a better understanding of what they do.

## Signing cookies

It is possible to sign a cookie to automatically verify its contents when it is received. Since it's relatively easy to spoof HTTP headers, this is a good idea for any information that you do not want someone to be able to fake, like authentication information (see [sessions](../sessions)).

To sign a cookie, provide one or more `secrets` when you first create the cookie:

```js
let cookie = createCookie("user-prefs", {
  secrets: ["s3cret1"]
});
```

Cookies that have one or more `secrets` will be stored and verified in a way that ensures the cookie's integrity.

Secrets may be rotated by adding new secrets to the front of the `secrets` array. Cookies that have been signed with old secrets will still be decoded successfully in `cookie.parse()`, and the newest secret (the first one in the array) will always be used to sign outgoing cookies created in `cookie.serialize()`.

```js
// app/cookies.js
let cookie = createCookie("user-prefs", {
  secrets: ["n3wsecr3t", "olds3cret"]
});

// in your route module...
export function loader({ request }) {
  let oldCookie = request.headers.get("Cookie");
  // oldCookie may have been signed with "olds3cret", but still parses ok
  let value = cookie.parse(oldCookie);

  new Response("...", {
    headers: {
      // Set-Cookie is signed with "n3wsecr3t"
      "Set-Cookie": cookie.serialize(value)
    }
  });
}
```

## `createCookie`

Creates a logical container for managing a browser cookie from there server.

```ts
import { createCookie } from "remix";

let cookie = createCookie("cookie-name", {
  // all of these are optional defaults that can be overridden at runtime
  domain: "remix.run",
  expires: new Date(Date.now() + 60),
  httpOnly: true,
  maxAge: 60,
  path: "/",
  sameSite: "lax",
  secrets: ["s3cret1"],
  secure: true
});
```

To learn more about each attribute, please see the [MDN Set-Cookie docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes).

## `isCookie`

Returns `true` if an object is a Remix cookie container.

```ts
import { isCookie } from "remix";
let cookie = createCookie("user-prefs");
console.log(isCookie(cookie));
// true
```

## Cookie API

A cookie container is returned from `createCookie` and has handful of properties and methods.

```ts
let cookie = createCookie(name);
cookie.name;
cookie.parse();
// etc.
```

### `cookie.name`

The name of the cookie, used in `Cookie` and `Set-Cookie` HTTP headers.

### `cookie.parse()`

Extracts and returns the value of this cookie in a given `Cookie` header.

```js
let value = cookie.parse(request.headers.get("Cookie"));
```

### `cookie.serialize()`

Serializes a value and combines it with this cookie's options to create a `Set-Cookie` header, suitable for use in an outgoing `Response`.

```js
new Response("...", {
  headers: {
    "Set-Cookie": cookie.serialize({ showBanner: true })
  }
});
```

### `cookie.isSigned`

Will be `true` if the cookie uses any `secrets`, `false` otherwise.

```js
let cookie = createCookie("user-prefs");
console.log(cookie.isSigned); // false

cookie = createCookie("user-prefs", { secrets: ["soopersekrit"] });
console.log(cookie.isSigned); // true
```

### `cookie.expires`

The `Date` on which this cookie expires. Note that if a cookie has both `maxAge` and `expires`, this value will the date at the current time plus the `maxAge` value since `Max-Age` takes precedence over `Expires`.

```js
let cookie = createCookie("user-prefs", {
  expires: new Date("2021-01-01")
});

console.log(cookie.expires); // "2020-01-01T00:00:00.000Z"
```

# Sessions

Sessions are an important part of websites that allow the server to identify requests coming from the same person, especially when it comes to server-side form validation or when JavaScript is not on the page. Sessions are a fundamental building block of many sites that let users "log in", including social, e-commerce, business, and educational websites.

In Remix, sessions are managed on a per-route basis (rather than something like express middleware) in your `loader` and `action` methods using a "session storage" object (that implements the `SessionStorage` interface). Session storage understands how to parse and generate cookies, and how to store session data in a database or filesystem.

Remix comes with several pre-built session storage options for common scenarios and one to create your own:

- `createCookieSessionStorage`
- `createFileSessionStorage`
- `createMemorySessionStorage`
- custom storage with `createSessionStorage`

## Using Sessions

This is an example of a cookie session storage:

```js filename=app/sessions.js
// app/sessions.js
import { createCookieSessionStorage } from "remix";

let { getSession, commitSession, destroySession } = createCookieSessionStorage({
  // a Cookie from `createCookie` or the CookieOptions to create one
  cookie: {
    name: "__session",

    // all of these are optional
    domain: "remix.run",
    expires: new Date(Date.now() + 60),
    httpOnly: true,
    maxAge: 60,
    path: "/",
    sameSite: "lax",
    secrets: ["s3cret1"],
    secure: true
  }
});

export { getSession, commitSession, destroySession };
```

We recommend setting up your session storage object in `app/sessions.js` so all routes that need to access session data can import from the same spot (also, see our [Route Module Constraints](../constraints/)).

The input/output to a session storage object are HTTP cookies. `getSession()` retrieves the current session from the incoming request's `Cookie` header, and `commitSession()`/`destroySession()` provide the `Set-Cookie` header for the outgoing response.

You'll use methods to get access to sessions in your `loader` and `action` functions.

A login form might look something like this:

```js filename=app/routes/login.js lines=2,5,7,12,16,22,31,36,41,46
import { json, redirect } from "remix";
import { getSession, commitSession } from "../sessions";

export async function loader({ request }) {
  let session = await getSession(request.headers.get("Cookie"));

  if (session.has("userId")) {
    // Redirect to the home page if they are already signed in.
    return redirect("/");
  }

  let data = { error: session.get("error") };

  return json(data, {
    headers: {
      "Set-Cookie": await commitSession(session)
    }
  });
}

export async function action({ request }) {
  let session = await getSession(request.headers.get("Cookie"));
  let bodyParams = new URLSearchParams(await request.text());

  let userId = await validateCredentials(
    bodyParams.get("username"),
    bodyParams.get("password")
  );

  if (userId == null) {
    session.flash("error", "Invalid username/password");

    // Redirect back to the login page with errors.
    return redirect("/login", {
      headers: {
        "Set-Cookie": await commitSession(session)
      }
    });
  }

  session.set("userId", userId);

  // Login succeeded, send them to the home page.
  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session)
    }
  });
}

export default function Login() {
  let { currentUser, error } = useRouteData();

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <form method="POST">
        <div>
          <p>Please sign in</p>
        </div>
        <label>
          Username: <input type="text" name="username" />
        </label>
        <label>
          Password: <input type="password" name="password" />
        </label>
      </form>
    </div>
  );
}
```

## Session Gotchas

Because of nested routes, multiple loaders can be called to construct a single page. When using `session.flash()` or `session.unset()`, you

## `createSession`

TODO:

## `isSession`

TODO:

## `createSessionStorage`

Remix makes it easy to store sessions in your own database if needed. The `createSessionStorage()` API requires a `cookie` (or options for creating a cookie, see [cookies](#cookies)) and a set of create, read, update, and delete (CRUD) methods for managing the session data. The cookie is used to persist the session ID.

The following example shows how you could do this using a generic database client:

```js
import { createSessionStorage } from "remix";

function createDatabaseSessionStorage({ cookie, host, port }) {
  // Configure your database client...
  let db = createDatabaseClient(host, port);

  return createSessionStorage({
    cookie,
    async createData(data, expires) {
      // `expires` is a Date after which the data should be considered
      // invalid. You could use it to invalidate the data somehow or
      // automatically purge this record from your database.
      let id = await db.insert(data);
      return id;
    },
    async readData(id) {
      return (await db.select(id)) || null;
    },
    async updateData(id, data, expires) {
      await db.update(id, data);
    },
    async deleteData(id) {
      await db.delete(id);
    }
  });
}
```

And then you can use it like this:

```js
let {
  getSession,
  commitSession,
  destroySession
} = createDatabaseSessionStorage({
  host: "localhost",
  port: 1234,
  cookie: {
    name: "__session",
    sameSite: "lax"
  }
});
```

The `expires` argument to `readData` and `updateData` is the same `Date` at which the cookie itself expires and is no longer valid. You can use this information to automatically purge the session record from your database to save on space, or to ensure that you do not otherwise return any data for old, expired cookies.

## `createCookieSessionStorage`

For purely cookie-based sessions (where the session data itself is stored in the session cookie with the browser, see [cookies](../cookies)) you can use `createCookieSessionStorage()`.

The main advantage of cookie session storage is that you don't need any additional backend services or databases to use it. It can also be beneficial in some load balanced scenarios. However, cookie-based sessions may not exceed the browser's max allowed cookie length (typically 4kb).

```js
import { createCookieSessionStorage } from "remix";

let { getSession, commitSession, destroySession } = createCookieSessionStorage({
  // a Cookie from `createCookie` or the same CookieOptions to create one
  cookie: {
    name: "__session",
    secrets: ["r3m1xr0ck5"],
    sameSite: "lax"
  }
});
```

## `createFileSessionStorage`

For file-backed sessions, use `createFileSessionStorage()`. File session storage requires a file system, but this should be readily available on most cloud providers that run express, maybe with some extra configuration.

The advantage of file-backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a regular file on disk, ideal for sessions with more than 4kb of data.

<docs-info>If you are deploying to a serverless function, ensure you have access to a persistent file system. They usually don't have one without extra configuration.</docs-info>

```js
// app/sessions.js
import { createCookie, createFileSessionStorage } from "remix";

// In this example the Cookie is created separately.
let sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true
});

let { getSession, commitSession, destroySession } = createFileSessionStorage({
  // The root directory where you want to store the files.
  // Make sure it's writable!
  dir: "/app/sessions",
  cookie: sessionCookie
});

export { getSession, commitSession, destroySession };
```

## `createMemorySessionStorage`

This storage keeps all the cookie information in your server's memory.

<docs-error>This should only be used in development. Use one of the other methods in production.</docs-error>

```js
// app/sessions.js
import { createCookie, createFileSessionStorage } from "remix";

// In this example the Cookie is created separately.
let sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true
});

let { getSession, commitSession, destroySession } = createFileSessionStorage({
  // The root directory where you want to store the files.
  // Make sure it's writable!
  dir: "/app/sessions",
  cookie: sessionCookie
});

export { getSession, commitSession, destroySession };
```

## Session API

After retrieving a session with `getSession`, the session object returned has a handful of methods and properties:

```js [2]
export async function action({ request }) {
  let session = await getSession(request.headers.get("Cookie"));
  session.get("foo");
  session.has("bar");
  // etc.
}
```

### `session.has(key)`

Returns `true` if the session has a variable with the given `name`.

```js
session.has("userId");
```

### `session.set(key, value)`

Sets a session value for use in subsequent requests:

```js
session.set("userId", "1234");
```

### `session.flash(key, value)`

Sets a session value that will be unset the first time it is read. After that, it's gone. Most useful for "flash messages" and server-side form validation messages:

```js [7-10,14]
import { getSession, commitSession } from "../sessions";

export async function action({ request, params }) {
  let session = await getSession(request.headers.get("Cookie"));
  let deletedProject = await archiveProject(params.projectId);

  session.flash(
    "globalMessage",
    `Project ${deletedProject.name} successfully archived`
  );

  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": await commitSession(session)
    }
  });
}
```

Now we can read the message in a loader.

<docs-info>You must commit the session whenever you read a `flash`. This is different than you might be used to where some type of middleware automatically sets the cookie header for you.</docs-info>

```js [8,9,18,25,34]
import React from "react";
import { Outlet } from "react-router-dom";
import { Meta, Links, Scripts, json } from "remix";

import { getSession, commitSession } from "./sessions";

export async function loader({ request }) {
  let session = await getSession(request.headers.get("Cookie"));
  let message = session.get("globalMessage") || null;

  return json(
    { message },
    {
      headers: {
        // When working with flash messages, it's important to remember
        // to commit the session after a session.get() because the session
        // contents have changed!
        "Set-Cookie": await commitSession(session)
      }
    }
  );
}

export default function App() {
  let { message } = useRouteData();

  return (
    <html>
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        {message && <div className="flash">{message}</div>}
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
```

### `session.get()`

Accesses a session value from a previous request:

```js
session.get("name");
```

### `session.unset()`

Removes a value from the session.

```js
session.unset("name");
```

<docs-info>You must commit the session whenever you `unset`</docs-info>

```js
return json(data, {
  headers: {
    "Set-Cookie": await commitSession(session)
  }
});
```

# Types

```ts
import type {
  ActionFunction,
  LoaderFunction,
  MetaFunction,
  LinksFunction
} from "remix";
```
