---
title: Remix Package
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

## ~~`useRouteData`~~

<docs-warning>Deprecated, use <a href="#useLoaderData">useLoaderData</a></docs-warning>

## `useLoaderData`

This hook returns the JSON parsed data from your route data loader.

```tsx [2,9]
import React from "react";
import { useLoaderData } from "remix";

export function loader() {
  return fakeDb.invoices.findAll();
}

export default function Invoices() {
  let invoices = useLoaderData();
  // ...
}
```

## `<Form>`

The `<Form>` component is a declarative way to perform data mutations: creating, updating, and deleting data. While it might be a mindshift to think about these tasks as "navigation", it's how the web has handled mutations since before JavaScript was created!

- Whether JavaScript is on the page or not, your data interactions created with `<Form>` and `action` will work.
- After a `<Form>` submit, all of the loaders on the page will be reloaded. This ensures that any updates to your data on the server are reflected with fresh fetches from your loaders.
- You can build "optimistic UI" and pending indicators with `useTransition`
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

### `<Form submissionKey>`

This provides a way to connect a specific form to `useActionData` and `useTransition`. It also puts Remix's navigation into "concurrent submissions mode" where multiple submissions can be pending simultaneously without cancelling each other (see [Concurrent Submissions](../../guides/concurrent-submissions)).

<docs-info>The submission key must be <b>globally unique</b>. This allows other components (and especially parent routes) to also create optimistic UI around the submission.</docs-info>

See also:

- [Concurrent Submissions](../../guides/concurrent-submissions)
- [`useTransition`](#usetransition)
- [`useActionData`](#usetransition)
- [`useSubmit`](#usesubmit)

## `useActionData`

This hook returns the JSON parsed data from your route action. If there has been no submsision at the current location it returns undefined.

```tsx [2,11,20]
import React from "react";
import { useActionData } from "remix";

export function action({ request }) {
  let body = new URLSearchParams(await request.text());
  let name = body.get("visitorsName");
  return { message: `Hello, ${name}` };
}

export default function Invoices() {
  let data = useActionData();
  return (
    <Form method="post">
      <p>
        <label>
          What is your name?
          <input type="text" name="visitorsName" />
        </label>
      </p>
      <p>{data ? data.message : "Waiting..."}</p>;
    </Form>
  );
}
```

### Notes about resubmissions

Form submissions are navigation events in browsers (and Remix), which means users can click the back button into a location that had a form submission _and the browser will resubmit the form_. You usually don't even want this to happen.

For example, consider this user flow:

1. The user lands at `/buy`
2. They submit a form to `/checkout`
3. They click a link to `/order/123`

The history stack looks like this, where "\*" is the current entry:

```
GET /buy > POST /checkout > *GET /order/123
```

Now consider the user clicks the back button 😨

```
GET /buy - *POST /checkout < GET /order/123
```

The browser will repost the same information and likely charge their credit card again. You usually don't want this.

The decades-old best practice is to redirect in the POST request. This way the location disappears from the browser's history stack and the user can't "back into it" anymore.

```
GET /buy > POST /checkout, Redirect > GET /order/123
```

This results in a history stack that looks like this:

```
GET /buy - *GET /order/123
```

Now the user can click back without resubmitting the form.

With progressively enhanced Forms, Remix follows the browser behavior by resubmitting forms when the user clicks back, forward, or refreshes into the location. If you don't want the form to be resubmit on back clicks/refreshes you will want to redirect out of your actions.

<docs-warning>If you don't redirect from an action, make sure reposting the same information isn't dangerous to your data or your visitor.</docs-warning>

If you're supposed to redirect from actions instead of return data, you might be wondering wtheck is the point of this hook? The most common use-case is form validation errors. If the form isn't right, you can simply return the errors and let the user try again (instead of pushing all the errors into sessions).

```tsx
import { redirect, json, Form } from "remix";

export function action({ request }) {
  let body = Object.fromEntries(
    new URLSearchParams(await request.text())
  );
  let errors = {};

  // validate the fields
  if (!body.email.includes("@")) {
    errors.email =
      "That doesn't look like an email address";
  }

  if (body.password.length < 6) {
    errors.password = "Password must be > 6 characters";
  }

  // return data if we have errors
  if (Object.keys(errors).length) {
    return json(errors, { status: 422 });
  }

  // otherwise create the user and redirect
  await createUser(body);
  return redirect("/dashboard");
}

export default function Signup() {
  let errors = useActionData();

  return (
    <>
      <h1>Signup</h1>
      <Form method="post">
        <p>
          <input type="text" name="email" />
          {errors?.email && <span>{errors.email}</span>}
        </p>
        <p>
          <input type="text" name="password" />
          {errors?.password && (
            <span>{errors.password}</span>
          )}
        </p>
        <p>
          <button type="submit">Sign up</button>
        </p>
      </Form>
    </>
  );
}
```

Another case is a UI where there are lots of concurrent submissions and you want to get the unique result of each of them as they resolve. To learn more, see [Concurrent Submissions](../../guides/concurrent-submissions/)

See also:

- [`action`](../app/#action)
- [`useTransition`](#usetransition)
- [Concurrent Submissions](../../guides/concurrent-submissions)

### `useActionData(key)`

You can also pass in a submission key to get the unique result of different forms on the same page:

```tsx [5, 6, 10, 13, 15, 18]
import React from "react";
import { useActionData } from "remix";

export default function Invoices() {
  let paidData = useActionData("paid");
  let archivedData = useActionData("archive");

  return (
    <div>
      <Form submissionKey="paid" method="post">
        <input
          type="hidden"
          name="_action"
          value="mark-paid"
        />
        <button type="submit">Mark Paid</button>
        <p>{paidData?.error && paidData.error}</p>
      </Form>
      <Form submissionKey="archive" method="post">
        <input
          type="hidden"
          name="_action"
          value="archive"
        />
        <button type="submit">Archive Invoice</button>
        <p>{archiveData?.error && archiveData.error}</p>
      </Form>
    </div>
  );
}
```

When using keys make sure to read the [Concurrent Submissions Guide](../../guides/concurrent-submissions).

## `useFormAction`

Resolves the value of a `<form action>` attribute using React Router's relative paths. This can be useful when computing the correct action for a `<button formAction>`, for example, when a `<button>` changes the action of its `<form>`.

```tsx
<button
  formAction={useFormAction("destroy")}
  formMethod="DELETE"
>
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
  let [sessionTimeout, setSessionTimeout] = useState(
    initialTimeout
  );

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

### `useSubmit(key)`

Just like `<Form submissionKey>`, this provides a way to connect a specific `useSubmit` to `useActionData` and `useTransition`. It also puts Remix's navigation into "concurrent submissions mode" where multiple submissions can be pending simultaneously without cancelling each other (see [Concurrent Submissions](../../guides/concurrent-submissions)).

<docs-info>The submission key must be <b>globally unique</b>. This allows other components (and especially parent routes) to also create optimistic UI around the submission.</docs-info>

See also:

- [Concurrent Submissions](../../guides/concurrent-submissions)
- [`useTransition`](#usetransition)
- [`useActionData`](#usetransition)
- [`<Form submissionKey>`](#form-submissionkey)

## ~`usePendingLocation`~

<docs-warning>Deprecated, use <a href="#usetransition"><code>useTransition</code></a></docs-warning>

## ~~`usePendingFormSubmit`~~

<docs-warning>Deprecated, use <a href="#usetransition">useTransition</a></docs-warning>

## `useTransition`

This hook tells you everything you need to know about a page transition to build pending navigation indicators and optimistic UI on data mutations. Things like:

- Global loading spinners
- Spinners on clicked links
- Disabling forms while the mutation is happening
- Adding spinners to submit buttons
- Optimistically showing a new record while it's being created on the server
- Optimistically showing the new state of a record while it's being updated

```js
import { useTransition } from "remix";

function SomeComponent() {
  let transition = useTransition();
  let transition = useTransition(submissionKey);
  transition.state;
  transtion.type;
  transition.formData;
  transition.nextLocation;
}
```

### `transition.state`

You can know the state of the transition with `transition.state`, it will be one of:

- `"idle"` - There is no transition pending.
- `"submitting"` - A form has been submitted and the route action is currently being called.
- `"loading"` - The loaders for the routes are being called to render the next page.

Normal navigations and GET form submissions transition as follows:

```
idle → loading → idle
```

Form submissions with POST, PUT, PATCH, or DELETE transition as follows:

```
idle → submitting → loading → idle
```

```tsx
function SubmitButton() {
  let transition = useTransition();

  let text =
    : transition.state === "submitting"
    ? "Saving..."
    : transition.state === "loading"
    ? "Loading..."
    : "Go"

  return <button type="submit">{text}</button>;
}
```

### `transition.type`

Most pending UI only cares about `transition.state`, but the transition can tell you even more information on `transition.type`.

Remix calls your route loaders at various times, like on normal link clicks or after a form submission completes. If you'd like to build pending indication that is more granular than "loading" and "submitting", use the `transition.type`.

- When `transition.state` is "loading", `transtion.type` is one of:

  - **"load"** - Normal load from link clicks
  - **"redirect"** - A loader redirected
  - **"actionRedirect"** - an action redirected
  - **"actionReload"** - an action completed and did not redirect
  - **"getSubmission"** - a form with method GET was submitted, this doesn't call the action (because it's a GET), but the `transition.formData` is still available
  - **"getSubmissionRedirect"** - a form with method GET was submitted and the loader redirected and the `transition.formData` will be available

- When `transition.state` is "idle", the type is always **"idle"**.

- When `transition.state` is "submitting", the type is always **"submission"**.

```tsx
function SubmitButton() {
  let transition = useTransition();

  let loadTexts = {
    actionRedirect: "Data saved, redirecting...",
    actionReload: "Data saved, reloading fresh data...",
  };

  let text =
    transition.state === "submitting"
      ? "Saving..."
      : transition.state === "loading"
      ? loadTexts[transition.type] || "Loading..."
      : "Go";

  return <button type="submit"></button>;
}
```

### `transition.formData`

Any transition that started from a `<Form>` or `useSubmit` will have your form's [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) attached to it.

Use this to build "Optimistic UI". Even though the data hasn't been saved to the database yet (it's on the way) we know enough in the client to act like it was saved immediately. This is a great way to get rid of spinners and make your UX lightning fast. Check out the [Optimistic UI Guide](../../optimistic-ui/) for some examples and how to handle failed submissions (its good to be optimistic, but you gotta be real too).

```tsx [2, 5-7, 14]
function Tasks() {
  let transition = useTransition();
  let tasks = useLoaderData();

  let optimisticTask = transition.formData ? (
    <li>{transition.formData.get("title")}</li>
  ) : null;

  return (
    <ul>
      {tasks.map((project) => (
        <li>{task.title}</li>
      ))}
      {optimisticTask}
      <li>
        <Form method="post">
          <label>
            New Task: <input type="text" name="title" />
          </label>
        </Form>
      </li>
    </ul>
  );
}
```

### `transition.nextLocation`

This tells you what the next location is going to be. Its most useful when matching against the next URL for custom links and hooks.

For example, this `Link` knows when it's page is loading and it's about to become active:

```tsx [7-9]
import { Link, useResolvedPath } from "react-router-dom";

function PendingLink({ to, children }) {
  let transition = useTransition();
  let path = useResolvedPath(to);

  let isPending =
    transition.state === "loading" &&
    transition.nextLocation.pathname === path.pathname;

  return (
    <Link
      data-pending={isPending ? "true" : null}
      to={to}
      children={children}
    />
  );
}
```

Note that this link will not appear "pending" if a form is being submit to the URL the link points to because we only do this for "loading" states. The form will contain the pending UI for whie the state is "submitting", once the action is complete, then the link will go pending.

### `useTransition(key)`

Normally there's only one transition at a time in the browser, and since mutations in Remix are modeled with form navigations, it might seem limiting. Sometimes you need to build more complex UI where there are lists of records, each with their own submit buttons, checkboxes etc. that should be able to be submitted concurrently. "Mutations as navigation" might sound like it falls down for the use-cases, but it does not!

Remix allows you to build these complex user interfaces with the same, simple navigation + action + loader model.

When you pass in a `submissionKey` you'll get the _specific transition_ for a _specific form_ and then Remix tracks all of the transitions individually. It will take care of making sure the freshest data available is displayed along the way, and will even cancel the requests with `AbortController` when appropriate.

<docs-info>The submission key must be globally unique! This way parent layouts can participate in optimistic UI as well.</docs-info>

Note the "paid" and "archive" keys used here:

```tsx [5, 6, 11-12, 21, 28-29, 39]
import React from "react";
import { useTransition } from "remix";

export default function Invoices() {
  let paidTsn = useTransition("paid");
  let archiveTsn = useTransition("archive");

  return (
    <div>
      <Form
        // links this form to the first useTransition
        submissionKey="paid"
        method="post"
      >
        <input
          type="hidden"
          name="_action"
          value="mark-paid"
        />
        <button
          disabled={Boolean(paidTsn.state === "submitting")}
          type="submit"
        >
          Mark Paid
        </button>
      </Form>
      <Form
        // links this form to the second useTransition
        submissionKey="archive"
        method="post"
      >
        <input
          type="hidden"
          name="_action"
          value="archive"
        />
        <button
          disabled={Boolean(
            archiveTsn.state === "submitting"
          )}
          type="submit"
        >
          Archive Invoice
        </button>
      </Form>
    </div>
  );
}
```

Now the user can click both buttons quickly and both mutations will can be done in parallel.

Submissoin keys are most commonly used for lists of records. In the next example, note that each `<Task>` will only get the transition for it's unique submissions, allowing the user click the checkbox on multiple tasks in quickly.

Remix manage the requests, cancellations, and the data reloads automatically, ensuring the UI always shows the latest values from the server across the entire page.

```tsx [16]
function TaskList({ tasks }) {
  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>
          <Task task={task} />
        </li>
      ))}
    </ul>
  );
}

function Task({ task }) {
  let key = String(task.id);
  let submit = useSubmit(key);
  let transition = useTransition(key);

  let checked =
    transition.state === "submitting" ||
    transition.state === "loading"
      ? // optimistic UI for this specific task
        transition.formData.get("complete") === "on"
      : // idle, use the latest from the server
        task.complete;

  return (
    <Form submissionKey={key}>
      <label>
        <input type="hidden" name="id" value={task.id} />
        <input
          type="checkbox"
          checked={checked}
          name="complete"
          onChange={(event) => {
            submit(event.target.form, { method: "put" });
          }}
        /> {task.title}
      </label>
    </Form>
  );
}
```

See also

- [Concurrent Submissions](../../guides/concurrent-submissions/)
- [`<Form submissionKey>`](#form-submissionkey)
- [`useSubmit(key)`](#usesubmitkey)
- [`useActionData(key)`](#useactiondatakey)

## `useTransitions`

Returns a [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) of form submission [transitions](#usetransition) by submission key.

This is useful for components throughout the app that don't contain the forms being submitted but _do_ display the data the forms are changing. It allows something like a sidebar to also build pending and optimistic UI while the form is being submitted.

```js
function SomeComponent() {
  let submissions = useTransitions();
  let submission1 = submissions.get("one");
  let submission2 = submissions.get("two");
  // ...
}
```

See also:

- [Concurrent Submissions](../../guides/concurrent-submissions/) for example usage.

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
  { pathname, data, params, handle }, // child route
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
     breadcrumb: () => <Link to="/parent">Some Route</Link>,
   };
   ```

2. We can do the same for a child route

   ```tsx
   // routes/parent/child.tsx
   export let handle = {
     breadcrumb: () => (
       <Link to="/parent/child">Child Route</Link>
     ),
   };
   ```

3. Now we can put it all together in our root route with `useMatches`.

   ```tsx [5, 16-22]
   // root.tsx
   import {
     Links,
     Scripts,
     useLoaderData,
     useMatches,
   } from "remix";

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

Another common use case is [enabling JavaScript for some routes and not others](../../guides/disabling-javascript/).

Once again, `useMatches` with `handle` is a great way for routes to participate in rendering abstractions at the top of element tree, above where the route is actually rendered.

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
      "Content-Type": "application/json; charset=utf-8",
    },
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
        "Cache-Control": "no-store",
      },
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
    "Set-Cookie": await commitSession(session),
  },
});

redirect(path, {
  status: 302,
  headers: {
    "Set-Cookie": await commitSession(session),
  },
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
    Location: "/else/where",
  },
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
  maxAge: 604_800, // one week
});
```

Then, you can `import` the cookie and use it in your `loader` and/or `action`. The `loader` in this case just checks the value of the user preference so you can use it in your component for deciding whether or not to render the banner. When the button is clicked, the `<form>` calls the `action` on the server and reloads the page without the banner.

**Note:** We recommend (for now) that you create all the cookies your app needs in `app/cookies.js` and `import` them into your route modules. This allows the Remix compiler to correctly prune these imports out of the browser build where they are not needed. We hope to eventually remove this caveat.

```js
// app/routes/index.js
import React from "react";
import { useLoaderData, json, redirect } from "remix";

import { userPrefs as cookie } from "../cookies";

export function loader({ request }) {
  let value =
    cookie.parse(request.headers.get("Cookie")) || {};
  let showBanner =
    "showBanner" in value ? value.showBanner : true;
  return { showBanner };
}

export async function action({ request }) {
  let value =
    cookie.parse(request.headers.get("Cookie")) || {};
  let bodyParams = new URLSearchParams(
    await request.text()
  );

  if (bodyParams.get("bannerVisibility") === "hidden") {
    value.showBanner = false;
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": cookie.serialize(value),
    },
  });
}

export default function Home() {
  let { showBanner } = useLoaderData();

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
  maxAge: 60,
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
  secrets: ["s3cret1"],
});
```

Cookies that have one or more `secrets` will be stored and verified in a way that ensures the cookie's integrity.

Secrets may be rotated by adding new secrets to the front of the `secrets` array. Cookies that have been signed with old secrets will still be decoded successfully in `cookie.parse()`, and the newest secret (the first one in the array) will always be used to sign outgoing cookies created in `cookie.serialize()`.

```js
// app/cookies.js
let cookie = createCookie("user-prefs", {
  secrets: ["n3wsecr3t", "olds3cret"],
});

// in your route module...
export function loader({ request }) {
  let oldCookie = request.headers.get("Cookie");
  // oldCookie may have been signed with "olds3cret", but still parses ok
  let value = cookie.parse(oldCookie);

  new Response("...", {
    headers: {
      // Set-Cookie is signed with "n3wsecr3t"
      "Set-Cookie": cookie.serialize(value),
    },
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
  secure: true,
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
    "Set-Cookie": cookie.serialize({ showBanner: true }),
  },
});
```

### `cookie.isSigned`

Will be `true` if the cookie uses any `secrets`, `false` otherwise.

```js
let cookie = createCookie("user-prefs");
console.log(cookie.isSigned); // false

cookie = createCookie("user-prefs", {
  secrets: ["soopersekrit"],
});
console.log(cookie.isSigned); // true
```

### `cookie.expires`

The `Date` on which this cookie expires. Note that if a cookie has both `maxAge` and `expires`, this value will the date at the current time plus the `maxAge` value since `Max-Age` takes precedence over `Expires`.

```js
let cookie = createCookie("user-prefs", {
  expires: new Date("2021-01-01"),
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

let {
  getSession,
  commitSession,
  destroySession,
} = createCookieSessionStorage({
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
    secure: true,
  },
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
  let session = await getSession(
    request.headers.get("Cookie")
  );

  if (session.has("userId")) {
    // Redirect to the home page if they are already signed in.
    return redirect("/");
  }

  let data = { error: session.get("error") };

  return json(data, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function action({ request }) {
  let session = await getSession(
    request.headers.get("Cookie")
  );
  let bodyParams = new URLSearchParams(
    await request.text()
  );

  let userId = await validateCredentials(
    bodyParams.get("username"),
    bodyParams.get("password")
  );

  if (userId == null) {
    session.flash("error", "Invalid username/password");

    // Redirect back to the login page with errors.
    return redirect("/login", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  }

  session.set("userId", userId);

  // Login succeeded, send them to the home page.
  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export default function Login() {
  let { currentUser, error } = useLoaderData();

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
          Password:{" "}
          <input type="password" name="password" />
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

function createDatabaseSessionStorage({
  cookie,
  host,
  port,
}) {
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
    },
  });
}
```

And then you can use it like this:

```js
let {
  getSession,
  commitSession,
  destroySession,
} = createDatabaseSessionStorage({
  host: "localhost",
  port: 1234,
  cookie: {
    name: "__session",
    sameSite: "lax",
  },
});
```

The `expires` argument to `readData` and `updateData` is the same `Date` at which the cookie itself expires and is no longer valid. You can use this information to automatically purge the session record from your database to save on space, or to ensure that you do not otherwise return any data for old, expired cookies.

## `createCookieSessionStorage`

For purely cookie-based sessions (where the session data itself is stored in the session cookie with the browser, see [cookies](../cookies)) you can use `createCookieSessionStorage()`.

The main advantage of cookie session storage is that you don't need any additional backend services or databases to use it. It can also be beneficial in some load balanced scenarios. However, cookie-based sessions may not exceed the browser's max allowed cookie length (typically 4kb).

```js
import { createCookieSessionStorage } from "remix";

let {
  getSession,
  commitSession,
  destroySession,
} = createCookieSessionStorage({
  // a Cookie from `createCookie` or the same CookieOptions to create one
  cookie: {
    name: "__session",
    secrets: ["r3m1xr0ck5"],
    sameSite: "lax",
  },
});
```

## `createFileSessionStorage`

For file-backed sessions, use `createFileSessionStorage()`. File session storage requires a file system, but this should be readily available on most cloud providers that run express, maybe with some extra configuration.

The advantage of file-backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a regular file on disk, ideal for sessions with more than 4kb of data.

<docs-info>If you are deploying to a serverless function, ensure you have access to a persistent file system. They usually don't have one without extra configuration.</docs-info>

```js
// app/sessions.js
import {
  createCookie,
  createFileSessionStorage,
} from "remix";

// In this example the Cookie is created separately.
let sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true,
});

let {
  getSession,
  commitSession,
  destroySession,
} = createFileSessionStorage({
  // The root directory where you want to store the files.
  // Make sure it's writable!
  dir: "/app/sessions",
  cookie: sessionCookie,
});

export { getSession, commitSession, destroySession };
```

## `createMemorySessionStorage`

This storage keeps all the cookie information in your server's memory.

<docs-error>This should only be used in development. Use one of the other methods in production.</docs-error>

```js
// app/sessions.js
import {
  createCookie,
  createFileSessionStorage,
} from "remix";

// In this example the Cookie is created separately.
let sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true,
});

let {
  getSession,
  commitSession,
  destroySession,
} = createFileSessionStorage({
  // The root directory where you want to store the files.
  // Make sure it's writable!
  dir: "/app/sessions",
  cookie: sessionCookie,
});

export { getSession, commitSession, destroySession };
```

## Session API

After retrieving a session with `getSession`, the session object returned has a handful of methods and properties:

```js [2]
export async function action({ request }) {
  let session = await getSession(
    request.headers.get("Cookie")
  );
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
  let session = await getSession(
    request.headers.get("Cookie")
  );
  let deletedProject = await archiveProject(
    params.projectId
  );

  session.flash(
    "globalMessage",
    `Project ${deletedProject.name} successfully archived`
  );

  return redirect("/dashboard", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
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
  let session = await getSession(
    request.headers.get("Cookie")
  );
  let message = session.get("globalMessage") || null;

  return json(
    { message },
    {
      headers: {
        // When working with flash messages, it's important to remember
        // to commit the session after a session.get() because the session
        // contents have changed!
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export default function App() {
  let { message } = useLoaderData();

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
    "Set-Cookie": await commitSession(session),
  },
});
```

# Types

```ts
import type {
  ActionFunction,
  LoaderFunction,
  MetaFunction,
  LinksFunction,
  ShouldReloadFunction,
} from "remix";
```
