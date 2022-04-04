---
title: React
order: 1
---

# `@remix-run/react`

This package provides all the components and hooks for React.

## `<Links>`, `<LiveReload>`, `<Meta>`, `<Scripts>`, `<ScrollRestoration>`

These components are to be used once inside of your root route (`root.tsx`). They include everything Remix figured out or built in order for your page to render properly.

```tsx
import type {
  LinksFunction,
  MetaFunction,
} from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import globalStylesheetUrl from "./global-styles.css";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: globalStylesheetUrl }];
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "My Amazing App",
  viewport: "width=device-width,initial-scale=1",
});

export default function App() {
  return (
    <html lang="en">
      <head>
        {/* All meta exports on all routes will go here */}
        <Meta />

        {/* All link exports on all routes will go here */}
        <Links />
      </head>
      <body>
        {/* Child routes go here */}
        <Outlet />

        {/* Manages scroll position for client-side transitions */}
        <ScrollRestoration />

        {/* Script tags go here */}
        <Scripts />

        {/* Sets up automatic reload when you change code */}
        {/* and only does anything during development */}
        <LiveReload />
      </body>
    </html>
  );
}
```

You can pass extra props to `<Scripts />` like `<Scripts crossOrigin />` for hosting your static assets on a different server than your app, or `<Script nonce={nonce}/>` for certain content security policies.

Learn more about `meta` and `links` exports in the [conventions](/api/conventions) documentation.

## `<Link>`

This component renders an anchor tag and is the primary way the user will navigate around your website. Anywhere you would have used `<a href="...">` you should now use `<Link to="..."/>` to get all the performance benefits of client-side routing in Remix.

It wraps React Router's Link with some extra behavior around resource prefetching.

```tsx
import { Link } from "@remix-run/react";

export default function GlobalNav() {
  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>{" "}
      <Link to="/account">Account</Link>{" "}
      <Link to="/support">Dashboard</Link>
    </nav>
  );
}
```

In our effort to remove all loading states from your UI, `Link` can automatically prefetch all the resources the next page needs: JavaScript modules, stylesheets, and data. This prop controls if and when that happens.

```tsx
<>
  <Link /> {/* defaults to "none" */}
  <Link prefetch="none" />
  <Link prefetch="intent" />
  <Link prefetch="render" />
</>
```

- **"none"** - Default behavior. This will prevent any prefetching from happening. This is recommended when linking to pages that require a user session that the browser won't be able to prefetch anyway.
- **"intent"** - Recommended if you want to prefetch. Fetches when Remix thinks the user intends to visit the link. Right now the behavior is simple: if they hover or focus the link it will prefetch the resources. In the future we hope to make this even smarter. Links with large click areas/padding get a bit of a head start.
- **"render"** - Fetches when the link is rendered.

<docs-error>You may need to use the <code>:last-of-type</code> selector instead of <code>:last-child</code> when styling child elements inside of your links</docs-error>

Remix uses the browser's cache for prefetching with HTML `<link rel="prefetch"/>` tags, which provides a lot of subtle benefits (like respecting HTTP cache headers, doing the work in browser idle time, using a different thread than your app, etc.) but the implementation might mess with your CSS since the link tags are rendered inside of your anchor tag. This means `a *:last-child {}` style selectors won't work. You'll need to change them to `a *:last-of-type {}` and you should be good. We will eventually get rid of this limitation.

## `<PrefetchPageLinks />`

This component renders all of the `<link rel="prefetch">` and `<link rel="modulepreload"/>` tags for all the assets (data, modules, css) of a given page.

This is the component `<Link rel="prefetch">` uses internally, but you render this component to prefetch a page for any other reason.

```tsx
<PrefetchPageLinks page="/absolute/path/to/your-path" />
```

**Note:** You need to use an absolute path.

## `<NavLink>`

A `<NavLink>` is a special kind of `<Link>` that knows whether or not it is "active". This is useful when building a navigation menu, such as a breadcrumb or a set of tabs where you'd like to show which of them is currently selected. It also provides useful context for assistive technology like screen readers.

By default, an `active` class is added to a `<NavLink>` component when it is active. You can pass a function as children to customize the content of the `<NavLink>` component based on their active state, specially useful to change styles on internal elements.

```tsx
import { NavLink } from "@remix-run/react";

function NavList() {
  // This styling will be applied to a <NavLink> when the
  // route that it links to is currently selected.
  const activeStyle = {
    textDecoration: "underline",
  };
  const activeClassName = "underline";
  return (
    <nav>
      <ul>
        <li>
          <NavLink
            to="messages"
            style={({ isActive }) =>
              isActive ? activeStyle : undefined
            }
          >
            Messages
          </NavLink>
        </li>
        <li>
          <NavLink
            to="tasks"
            className={({ isActive }) =>
              isActive ? activeClassName : undefined
            }
          >
            Tasks
          </NavLink>
        </li>
        <li>
          <NavLink to="tasks">
            {({ isActive }) => (
              <span
                className={
                  isActive ? activeClassName : undefined
                }
              >
                Tasks
              </span>
            )}
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
```

If the `end` prop is used, it will ensure this component isn't matched as "active" when its descendant paths are matched. For example, to render a link that is only active at the website root and not any other URLs, you can use:

```tsx
<NavLink to="/" end>
  Home
</NavLink>
```

## `<Form>`

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Singles</a>: <a href="https://www.youtube.com/watch?v=Iv25HAHaFDs&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Data Mutations with Form + action</a>, <a href="https://www.youtube.com/watch?v=w2i-9cYxSdc&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Multiple Forms and Single Button Mutations</a> and <a href="https://www.youtube.com/watch?v=bMLej7bg5Zo&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Clearing Inputs After Form Submissions</a></docs-success>

The `<Form>` component is a declarative way to perform data mutations: creating, updating, and deleting data. While it might be a mind-shift to think about these tasks as "navigation", it's how the web has handled mutations since before JavaScript was created!

```tsx
import { Form } from "@remix-run/react";

function NewEvent() {
  return (
    <Form method="post" action="/events">
      <input type="text" name="title" />
      <input type="text" name="description" />
    </Form>
  );
}
```

- Whether JavaScript is on the page or not, your data interactions created with `<Form>` and `action` will work.
- After a `<Form>` submission, all of the loaders on the page will be reloaded. This ensures that any updates to your data are reflected in the UI.
- `<Form>` automatically serializes your form's values (identically to the browser when not using JavaScript)
- You can build "optimistic UI" and pending indicators with [`useTransition`][usetransition]

### `<Form action>`

Most of the time you can omit this prop. Forms without an action prop (`<Form method="post">`) will automatically post to the same route within which they are rendered. This makes collocating your component, your data reads, and your data writes a snap.

If you need to post to a different route, then add an action prop:

```tsx
<Form action="/projects/new" method="post" />
```

When a POST is made to a URL, multiple routes in your route hierarchy will match the URL. Unlike a GET to loaders, where all of them are called to build the UI, _only one action is called_. The route called will be the deepest matching route, unless the deepest matching route is an "index route". In this case, it will post to the parent route of the index route (because they share the same URL).

If you want to post to an index route use `?index` in the action: `<Form action="/accounts?index" method="post" />`

| action url        | route action               |
| ----------------- | -------------------------- |
| `/accounts?index` | `routes/accounts/index.js` |
| `/accounts`       | `routes/accounts.js`       |

### `<Form method>`

This determines the [HTTP verb](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods) to be used: get, post, put, patch, delete. The default is "get".

```tsx
<Form method="post" />
```

Native `<form>` only supports get and post, so if you want your form to work with JavaScript on or off the page you'll need to stick with those two.

Without JavaScript, Remix will turn non-get requests into "post", but you'll still need to instruct your server with a hidden input like `<input type="hidden" name="_method" value="delete" />`. If you always include JavaScript, you don't need to worry about this.

<docs-info>We generally recommend sticking with "get" and "post" because the other verbs are not supported by HTML</docs-info>

### `<Form encType>`

Defaults to `application/x-www-form-urlencoded`, use `multipart/form-data` for file uploads.

### `<Form replace>`

```tsx
<Form replace />
```

Instructs the form to replace the current entry in the history stack, instead of pushing the new entry. If you expect a form to be submitted multiple times you may not want the user to have to click "back" for every submission to get to the previous page.

<docs-warning>This has no effect without JavaScript on the page.</docs-warning>

### `<Form reloadDocument>`

If true, it will submit the form with the browser instead of JavaScript, even if JavaScript is on the page.

```tsx
<Form reloadDocument />
```

<docs-info>This is recommended over <code>&lt;form></code></docs-info>

When the `action` prop is omitted, `<Form>` and `<form>` will sometimes call different actions depending on what the current URL is.

- `<form>` uses the current URL as the default which can lead to surprising results: forms inside parent routes will post to the child action if you're at the child's URL and the parents action when you're at the parent's URL. This means as the user navigates, the form's behavior changes.
- `<Form>` will always post to the route's action, independent of the URL. A form in a parent route will always post to the parent, even if you're at the child's URL.

See also:

- [`useTransition`][usetransition]
- [`useActionData`][useactiondata]
- [`useSubmit`][usesubmit]

## `<ScrollRestoration>`

This component will emulate the browser's scroll restoration on location changes. Hopefully you never notice this component at all!

It must be the last element on the page, right before the `<Scripts/>` tag:

```tsx lines=[4,5]
<html>
  <body>
    {/* ... */}
    <ScrollRestoration />
    <Scripts />
  </body>
</html>
```

In order to avoid (usually) the client-side routing "scroll flash" on refresh or clicking back into the app from a different domain, this component attempts to restore scroll _before React hydration_. If you render the script anywhere other than the bottom of the document the window will not be tall enough to restore to the correct position.

## `useLoaderData`

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Single</a>: <a href="https://www.youtube.com/watch?v=NXqEP_PsPNc&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Loading data into components</a></docs-success>

This hook returns the JSON parsed data from your route loader function.

```tsx lines=[2,9]
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader() {
  return json(await fakeDb.invoices.findAll());
}

export default function Invoices() {
  const invoices = useLoaderData();
  // ...
}
```

## `useActionData`

This hook returns the JSON parsed data from your route action. It returns `undefined` if there hasn't been a submission at the current location yet.

```tsx lines=[2,11,20]
import { json } from "@remix-run/node";
import { useActionData, Form } from "@remix-run/react";

export async function action({ request }) {
  const body = await request.formData();
  const name = body.get("visitorsName");
  return json({ message: `Hello, ${name}` });
}

export default function Invoices() {
  const data = useActionData();
  return (
    <Form method="post">
      <p>
        <label>
          What is your name?
          <input type="text" name="visitorsName" />
        </label>
      </p>
      <p>{data ? data.message : "Waiting..."}</p>
    </Form>
  );
}
```

The most common use-case for this hook is form validation errors. If the form isn't right, you can simply return the errors and let the user try again (instead of pushing all the errors into sessions and back out of the loader).

```tsx lines=[22, 31, 39-41, 45-47]
import { redirect, json } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";

export async function action({ request }) {
  const form = await request.formData();
  const email = form.get("email");
  const password = form.get("password");
  const errors = {};

  // validate the fields
  if (typeof email !== "string" || !email.includes("@")) {
    errors.email =
      "That doesn't look like an email address";
  }

  if (typeof password !== "string" || password.length < 6) {
    errors.password = "Password must be > 6 characters";
  }

  // return data if we have errors
  if (Object.keys(errors).length) {
    return json(errors, { status: 422 });
  }

  // otherwise create the user and redirect
  await createUser(form);
  return redirect("/dashboard");
}

export default function Signup() {
  const errors = useActionData();

  return (
    <>
      <h1>Signup</h1>
      <Form method="post">
        <p>
          <input type="text" name="email" />
          {errors?.email ? (
            <span>{errors.email}</span>
          ) : null}
        </p>
        <p>
          <input type="text" name="password" />
          {errors?.password ? (
            <span>{errors.password}</span>
          ) : null}
        </p>
        <p>
          <button type="submit">Sign up</button>
        </p>
      </Form>
    </>
  );
}
```

### Notes about resubmissions

When using `<Form>` (instead of `<form>` or `<Form reloadDocument>`), Remix _does not_ follow the browser's behavior of resubmitting forms when the user clicks back, forward, or refreshes into the location.

<docs-info>Remix client-side navigation does not resubmit forms on pop events like browsers.</docs-info>

Form submissions are navigation events in browsers (and Remix), which means users can click the back button into a location that had a form submission _and the browser will resubmit the form_. You usually don't ever want this to happen.

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

**When you should worry about this**

Usually your actions will either return validation issues or redirect, and then your data and your user's are safe no matter how the form is submitted. But to go into further detail, if you're using:

- `<form>`
- `<Form reloadDocument>`
- You're not rendering `<Scripts/>`
- The user has JavaScript disabled

The browser will resubmit the form in these situations unless you redirect from the action. If these are cases you want to support, we recommend you follow the age-old best practice of redirecting from actions.

If you're using `<Form>` and don't care to support the cases above, you don't need to redirect from your actions. However, if you don't redirect from an action, make sure reposting the same information isn't dangerous to your data or your visitors because you can't control if they have JavaScript enabled or not.

<docs-info>In general, if the form validation fails, return data from the action and render it in the component. But, once you actually change data (in your database, or otherwise), you should redirect.</docs-info>

See also:

- [`action`][action]
- [`useTransition`][usetransition]

## `useFormAction`

Resolves the value of a `<form action>` attribute using React Router's relative paths. This can be useful when computing the correct action for a `<button formAction>`, for example, when a `<button>` changes the action of its `<form>`.

```tsx
function SomeComponent() {
  return (
    <button
      formAction={useFormAction("destroy")}
      formMethod="post"
    >
      Delete
    </button>
  );
}
```

(Yes, HTML buttons can change the action of their form!)

## `useSubmit`

Returns the function that may be used to submit a `<form>` (or some raw `FormData`) to the server using the same process that `<Form>` uses internally `onSubmit`. If you're familiar with React Router's `useNavigate`, you can think about this as the same thing but for `<Form>` instead of `<Link>`.

This is useful whenever you need to programmatically submit a form. For example, you may wish to save a user preferences form whenever any field changes.

```tsx filename=app/routes/prefs.tsx lines=[2,14,18]
import { json } from "@remix-run/node";
import { useSubmit, useTransition } from "@remix-run/react";

export async function loader() {
  return json(await getUserPreferences());
}

export async function action({ request }) {
  await updatePreferences(await request.formData());
  return redirect("/prefs");
}

function UserPreferences() {
  const submit = useSubmit();
  const transition = useTransition();

  function handleChange(event) {
    submit(event.currentTarget, { replace: true });
  }

  return (
    <Form method="post" onChange={handleChange}>
      <label>
        <input type="checkbox" name="darkMode" value="on" />{" "}
        Dark Mode
      </label>
      {transition.state === "submitting" ? (
        <p>Saving...</p>
      ) : null}
    </Form>
  );
}
```

This can also be useful if you'd like to automatically sign someone out of your website after a period of inactivity. In this case, we've defined inactivity as the user hasn't navigated to any other pages after 5 minutes.

```tsx lines=[1,10,15]
import { useSubmit, useTransition } from "@remix-run/react";
import { useEffect } from "react";

function AdminPage() {
  useSessionTimeout();
  return <div>{/* ... */}</div>;
}

function useSessionTimeout() {
  const submit = useSubmit();
  const transition = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      submit(null, { method: "post", action: "/logout" });
    }, 5 * 60_000);

    return () => clearTimeout(timer);
  }, [submit, transition]);
}
```

## `useTransition`

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Singles</a>: <a href="https://www.youtube.com/watch?v=y4VLIFjFq8k&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Pending UI</a>, <a href="https://www.youtube.com/watch?v=bMLej7bg5Zo&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Clearing Inputs After Form Submissions</a>, and <a href="https://www.youtube.com/watch?v=EdB_nj01C80&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Optimistic UI</a></docs-success>

This hook tells you everything you need to know about a page transition to build pending navigation indicators and optimistic UI on data mutations. Things like:

- Global loading spinners
- Spinners on clicked links
- Disabling forms while the mutation is happening
- Adding spinners to submit buttons
- Optimistically showing a new record while it's being created on the server
- Optimistically showing the new state of a record while it's being updated

```js
import { useTransition } from "@remix-run/react";

function SomeComponent() {
  const transition = useTransition();
  transition.state;
  transition.type;
  transition.submission;
  transition.location;
}
```

### `transition.state`

You can know the state of the transition with `transition.state`. It will be one of:

- **idle** - There is no transition pending.
- **submitting** - A form has been submitted. If GET, then the route loader is being called. If POST, PUT, PATCH, DELETE, then the route action is being called.
- **loading** - The loaders for the next routes are being called to render the next page.

Normal navigation's transition as follows:

```
idle → loading → idle
```

GET form submissions transition as follows:

```
idle → submitting → idle
```

Form submissions with POST, PUT, PATCH, or DELETE transition as follows:

```
idle → submitting → loading → idle
```

```tsx
function SubmitButton() {
  const transition = useTransition();

  const text =
    transition.state === "submitting"
      ? "Saving..."
      : transition.state === "loading"
      ? "Saved!"
      : "Go";

  return <button type="submit">{text}</button>;
}
```

### `transition.type`

Most pending UI only cares about `transition.state`, but the transition can tell you even more information on `transition.type`.

Remix calls your route loaders at various times, like on normal link clicks or after a form submission completes. If you'd like to build pending indication that is more granular than "loading" and "submitting", use the `transition.type`.

Depending on the transition state, the types can be the following:

- `state === "idle"`

  - **idle** - The type is always idle when there's not a pending navigation.

- `state === "submitting"`

  - **actionSubmission** - A form has been submitted with POST, PUT, PATCH, or DELETE, and the action is being called
  - **loaderSubmission** - A form has been submitted with GET and the loader is being called

- `state === "loading"`

  - **loaderSubmissionRedirect** - A "loaderSubmission" was redirected by the loader and the next routes are being loaded
  - **actionRedirect** - An "actionSubmission" was redirected by the action and the next routes are being loaded
  - **actionReload** - The action from an "actionSubmission" returned data and the loaders on the page are being reloaded
  - **fetchActionRedirect** - An action [fetcher][usefetcher] redirected and the next routes are being loaded
  - **redirect** - A loader from a normal navigation (or redirect) redirected to a new location and the new routes are being loaded
  - **load** - A normal load from a normal navigation

```tsx
function SubmitButton() {
  const transition = useTransition();

  const loadTexts = {
    actionRedirect: "Data saved, redirecting...",
    actionReload: "Data saved, reloading fresh data...",
  };

  const text =
    transition.state === "submitting"
      ? "Saving..."
      : transition.state === "loading"
      ? loadTexts[transition.type] || "Loading..."
      : "Go";

  return <button type="submit">{text}</button>;
}
```

### `transition.submission`

Any transition that started from a `<Form>` or `useSubmit` will have your form's submission attached to it. This is primarily useful to build "Optimistic UI" with the `submission.formData` [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) object.

TODO: Example

### `transition.location`

This tells you what the next location is going to be. It's most useful when matching against the next URL for custom links and hooks.

For example, this `Link` knows when its page is loading and about to become active:

```tsx lines=[7-9]
import { Link, useResolvedPath } from "@remix-run/react";

function PendingLink({ to, children }) {
  const transition = useTransition();
  const path = useResolvedPath(to);

  const isPending =
    transition.state === "loading" &&
    transition.location.pathname === path.pathname;

  return (
    <Link
      data-pending={isPending ? "true" : null}
      to={to}
      children={children}
    />
  );
}
```

Note that this link will not appear "pending" if a form is being submitted to the URL the link points to, because we only do this for "loading" states. The form will contain the pending UI for when the state is "submitting", once the action is complete, then the link will go pending.

## `useFetcher`

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Singles</a>: <a href="https://www.youtube.com/watch?v=vTzNpiOk668&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Concurrent Mutations w/ useFetcher</a> and <a href="https://www.youtube.com/watch?v=EdB_nj01C80&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Optimistic UI</a></docs-success>

In HTML/HTTP, data mutations and loads are modeled with navigation: `<a href>` and `<form action>`. Both cause a navigation in the browser. The Remix equivalents are `<Link>` and `<Form>`.

But sometimes you want to call a loader outside of navigation, or call an action (and get the routes to reload) but you don't want the URL to change. Many interactions with the server aren't navigation events. This hook lets you plug your UI into your actions and loaders without navigating.

This is useful when you need to:

- fetch data not associated with UI routes (popovers, dynamic forms, etc.)
- submit data to actions without navigating (shared components like a newsletter sign ups)
- handle multiple concurrent submissions in a list (typical "todo app" list where you can click multiple buttons and all be pending at the same time)
- infinite scroll containers
- and more!

It is common for Remix newcomers to see this hook and think it is the primary way to interact with the server for data loading and updates--because it looks like what you might have done outside of Remix. If your use case can be modeled as "navigation", it's recommended you use one of the core data APIs before reaching for `useFetcher`:

- [`useLoaderData`][useloaderdata]
- [`Form`][form]
- [`useActionData`][useactiondata]
- [`useTransition`][usetransition]

If you're building a highly interactive, "app like" user interface, you will `useFetcher` often.

```tsx
import { useFetcher } from "@remix-run/react";

function SomeComponent() {
  const fetcher = useFetcher();

  // trigger the fetch with these
  <fetcher.Form {...formOptions} />;

  useEffect(() => {
    fetcher.submit(data, options);
    fetcher.load(href);
  }, [fetcher]);

  // build UI with these
  fetcher.state;
  fetcher.type;
  fetcher.submission;
  fetcher.data;
}
```

Notes about how it works:

- Automatically handles cancellation of the fetch at the browser level
- When submitting with POST, PUT, PATCH, DELETE, the action is called first
  - After the action completes, the loaders on the page are reloaded to capture any mutations that may have happened, automatically keeping your UI in sync with your server state
- When multiple fetchers are inflight at once, it will
  - commit the freshest available data as they each land
  - ensure no stale loads override fresher data, no matter which order the responses return
- Handles uncaught errors by rendering the nearest `ErrorBoundary` (just like a normal navigation from `<Link>` or `<Form>`)
- Will redirect the app if your action/loader being called returns a redirect (just like a normal navigation from `<Link>` or `<Form>`)

### `fetcher.state`

You can know the state of the fetcher with `fetcher.state`. It will be one of:

- **idle** - nothing is being fetched.
- **submitting** - A form has been submitted. If the method is GET, then the route loader is being called. If POST, PUT, PATCH, or DELETE, then the route action is being called.
- **loading** - The loaders for the routes are being reloaded after an action submission

.

### `fetcher.type`

This is the type of state the fetcher is in. It's like `fetcher.state`, but more granular. Depending on the fetcher's state, the types can be the following:

- `state === "idle"`

  - **init** - The fetcher isn't doing anything currently and hasn't done anything yet.
  - **done** - The fetcher isn't doing anything currently, but it has completed a fetch and you can safely read the `fetcher.data`.

- `state === "submitting"`

  - **actionSubmission** - A form has been submitted with POST, PUT, PATCH, or DELETE, and the action is being called.
  - **loaderSubmission** - A form has been submitted with GET and the loader is being called.

- `state === "loading"`

  - **actionReload** - The action from an "actionSubmission" returned data and the loaders on the page are being reloaded.
  - **actionRedirect** - The action from an "actionSubmission" returned a redirect and the page is transitioning to the new location.
  - **load** - A route's loader is being called without a submission (`fetcher.load()`).

### `fetcher.submission`

When using `<fetcher.Form>` or `fetcher.submit()`, the form submission is available to build optimistic UI.

It is not available when the fetcher state is "idle" or "loading".

### `fetcher.data`

The returned response data from your loader or action is stored here. Once the data is set, it persists on the fetcher even through reloads and resubmissions (like calling `fetcher.load()` again after having already read the data).

### `fetcher.Form`

Just like `<Form>` except it doesn't cause a navigation. (You'll get over the dot in JSX, don't worry.)

```tsx
function SomeComponent() {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post" action="/some/route">
      <input type="text" />
    </fetcher.Form>
  );
}
```

### `fetcher.submit()`

Just like `useSubmit` except it doesn't cause a navigation.

```tsx
function SomeComponent() {
  const fetcher = useFetcher();

  const onClick = () =>
    fetcher.submit({ some: "values" }, { method: "post" });

  // ...
}
```

### `fetcher.load()`

Loads data from a route loader.

```tsx
function SomeComponent() {
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.type === "init") {
      fetcher.load("/some/route");
    }
  }, [fetcher]);

  fetcher.data; // the data from the loader
}
```

### Examples

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Single</a>: <a href="https://www.youtube.com/watch?v=jd_bin5HPrw&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Remix Newsletter Signup Form</a></docs-success>

**Newsletter Signup Form**

Perhaps you have a persistent newsletter signup at the bottom of every page on your site. This is not a navigation event, so useFetcher is perfect for the job. First, you create a Resource Route:

```tsx filename=routes/newsletter/subscribe.tsx
export async function action({ request }) {
  const email = (await request.formData()).get("email");
  try {
    await subscribe(email);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message });
  }
}
```

Then, somewhere else in your app (your root layout in this example), you render the following component:

```tsx filename=routes/root.tsx
// ...

function NewsletterSignup() {
  const newsletter = useFetcher();
  const ref = useRef();

  useEffect(() => {
    if (newsletter.type === "done" && newsletter.data.ok) {
      ref.current.reset();
    }
  }, [newsletter]);

  return (
    <newsletter.Form
      ref={ref}
      method="post"
      action="/newsletter/subscribe"
    >
      <p>
        <input type="text" name="email" />{" "}
        <button
          type="submit"
          disabled={newsletter.state === "submitting"}
        >
          Subscribe
        </button>
      </p>

      {newsletter.type === "done" ? (
        newsletter.data.ok ? (
          <p>Thanks for subscribing!</p>
        ) : newsletter.data.error ? (
          <p data-error>{newsletter.data.error}</p>
        ) : null
      ) : null}
    </newsletter.Form>
  );
}
```

<docs-info>You can still provide a no-JavaScript experience</docs-info>

Because `useFetcher` doesn't cause a navigation, it won't automatically work if there is no JavaScript on the page like a normal Remix `<Form>` will because the browser will still navigate to the form's action.

If you want to support a no JavaScript experience, just export a component from the route with the action.

```tsx filename=routes/newsletter/subscribe.tsx
export async function action({ request }) {
  // just like before
}

export default function NewsletterSignupRoute() {
  const newsletter = useActionData();
  return (
    <Form method="post" action="/newsletter/subscribe">
      <p>
        <input type="text" name="email" />{" "}
        <button type="submit">Subscribe</button>
      </p>

      {newsletter.data.ok ? (
        <p>Thanks for subscribing!</p>
      ) : newsletter.data.error ? (
        <p data-error>{newsletter.data.error}</p>
      ) : null}
    </Form>
  );
}
```

- When JS is on the page, the user will subscribe to the newsletter and the page won't change, they'll just get a solid, dynamic experience
- When JS is not on the page, they'll be transitioned to the signup page by the browser.

You could even refactor the component to take props from the hooks and reuse it:

```tsx filename=routes/newsletter/subscribe.tsx
import { Form, useFetcher } from "@remix-run/react";

// used in the footer
export function NewsletterSignup() {
  const newsletter = useFetcher();
  return (
    <NewsletterForm
      Form={newsletter.Form}
      data={newsletter.data}
      state={newsletter.state}
      type={newsletter.type}
    />
  );
}

// used here and in the route
export function NewsletterForm({
  Form,
  data,
  state,
  type,
}) {
  // refactor a bit in here, just read from props instead of useFetcher
}
```

And now you could reuse the same form, but it gets data from a different hook for the no-js experience:

```tsx filename=routes/newsletter/subscribe.tsx
import { Form } from "@remix-run/react";

import { NewsletterForm } from "~/NewsletterSignup";

export default function NewsletterSignupRoute() {
  const data = useActionData();
  return (
    <NewsletterForm
      Form={Form}
      data={data}
      state="idle"
      type="done"
    />
  );
}
```

**Mark Article as Read**

Imagine you want to mark an article has been read by the current user after they've been on the page for a while and scrolled to the bottom, you could make a hook that looks something like this:

```tsx
function useMarkAsRead({ articleId, userId }) {
  const marker = useFetcher();

  useSpentSomeTimeHereAndScrolledToTheBottom(() => {
    marker.submit(
      { userId },
      {
        method: "post",
        action: `/article/${articleID}/mark-as-read`,
      }
    );
  });
}
```

**User Avatar Details Popup**

Anytime you show the user avatar, you could put a hover effect that fetches data from a loader and displays it in a popup.

```tsx filename=routes/user/$id/details.tsx
export async function loader({ params }) {
  return json(
    await fakeDb.user.find({ where: { id: params.id } })
  );
}

function UserAvatar({ partialUser }) {
  const userDetails = useFetcher();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (showDetails && userDetails.type === "init") {
      userDetails.load(`/users/${user.id}/details`);
    }
  }, [showDetails, userDetails]);

  return (
    <div
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <img src={partialUser.profileImageUrl} />
      {showDetails ? (
        userDetails.type === "done" ? (
          <UserPopup user={userDetails.data} />
        ) : (
          <UserPopupLoading />
        )
      ) : null}
    </div>
  );
}
```

**Async Reach UI Combobox**

If the user needs to select a city, you could have a loader that returns a list of cities based on a query and plug it into a Reach UI combobox:

```tsx filename=routes/city-search.tsx
export async function loader({ request }) {
  const url = new URL(request.url);
  return json(
    await searchCities(url.searchParams.get("city-query"))
  );
}

function CitySearchCombobox() {
  const cities = useFetcher();

  return (
    <cities.Form method="get" action="/city-search">
      <Combobox aria-label="Cities">
        <div>
          <ComboboxInput
            name="city-query"
            onChange={(event) =>
              cities.submit(event.target.form)
            }
          />
          {cities.state === "submitting" ? (
            <Spinner />
          ) : null}
        </div>

        {cities.data ? (
          <ComboboxPopover className="shadow-popup">
            {cities.data.error ? (
              <p>Failed to load cities :(</p>
            ) : cities.data.length ? (
              <ComboboxList>
                {cities.data.map((city) => (
                  <ComboboxOption
                    key={city.id}
                    value={city.name}
                  />
                ))}
              </ComboboxList>
            ) : (
              <span>No results found</span>
            )}
          </ComboboxPopover>
        ) : null}
      </Combobox>
    </cities.Form>
  );
}
```

## `useFetchers`

Returns an array of all inflight fetchers.

This is useful for components throughout the app that didn't create the fetchers but want to use their submissions to participate in optimistic UI.

For example, imagine a UI where the sidebar lists projects, and the main view displays a list of checkboxes for the current project. The sidebar could display the number of completed and total tasks for each project.

```
┌─────────────────┬────────────────────────────┐
│                 │                            │
│   Soccer  (8/9) │ [x] Do the dishes          │
│                 │                            │
│ > Home    (2/4) │ [x] Fold laundry           │
│                 │                            │
│                 │ [ ] Replace battery in the │
│                 │     smoke alarm            │
│                 │                            │
│                 │ [ ] Change lights in kids  │
│                 │     bathroom               │
│                 │                            │
└─────────────────┴────────────────────────────┘
```

When the user clicks a checkbox, the submission goes to the action to change the state of the task. Instead of creating a "loading state" we want to create an "optimistic UI" that will **immediately** update the checkbox to appear checked even though the server hasn't processed it yet. In the checkbox component, we can use `fetcher.submission`:

```tsx
function Task({ task }) {
  const toggle = useFetcher();
  const checked = toggle.submission
    ? // use the optimistic version
      Boolean(toggle.submission.formData.get("complete"))
    : // use the normal version
      task.complete;

  const { projectId, id } = task;
  return (
    <toggle.Form
      method="put"
      action={`/project/${projectId}/tasks/${id}`}
    >
      <label>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => toggle.submit(e.target.form)}
        />
      </label>
    </toggle.Form>
  );
}
```

This awesome for the checkbox, but the sidebar will say 2/4 while the checkboxes show 3/4 when the user clicks on of them!

```
┌─────────────────┬────────────────────────────┐
│                 │                            │
│   Soccer  (8/9) │ [x] Do the dishes          │
│                 │                            │
│ > Home    (2/4) │ [x] Fold laundry           │
│                 │                            │
│          CLICK!-->[x] Replace battery in the │
│                 │     smoke alarm            │
│                 │                            │
│                 │ [ ] Change lights in kids  │
│                 │     bathroom               │
│                 │                            │
└─────────────────┴────────────────────────────┘
```

Because Remix will automatically reload the routes, the sidebar will quickly update and be correct. But for a moment, it's gonna feel a little funny.

This is where `useFetchers` comes in. Up in the sidebar, we can access all the inflight fetcher states from the checkboxes - even though it's not the component that created them.

The strategy has three steps:

1. Find the submissions for tasks in a specific project
2. Use the `fetcher.submission.formData` to immediately update the count
3. Use the normal task's state if it's not inflight

Here's some sample code:

```js
function ProjectTaskCount({ project }) {
  const fetchers = useFetchers();
  let completedTasks = 0;

  // 1) Find my task's submissions
  const myFetchers = new Map();
  for (const f of fetchers) {
    if (
      f.submission &&
      f.submission.action.startsWith(
        `/projects/${project.id}/task`
      )
    ) {
      const taskId = f.submission.formData.get("id");
      myFetchers.set(
        parseInt(taskId),
        f.submission.formData.get("complete") === "on"
      );
    }
  }

  for (const task of project.tasks) {
    // 2) use the optimistic version
    if (myFetchers.has(task.id)) {
      if (myFetchers.get(task.id)) {
        completedTasks++;
      }
    }
    // 3) use the normal version
    else if (task.complete) {
      completedTasks++;
    }
  }

  return (
    <small>
      {completedTasks}/{project.tasks.length}
    </small>
  );
}
```

## `useMatches`

Returns the current route matches on the page. This is useful for creating layout abstractions with your current routes.

```js
function SomeComponent() {
  const matches = useMatches();

  // ...
}
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

Pairing route `handle` with `useMatches`, you can build your own, similar conventions to Remix's built-in `<Meta>`, `<Links>`, and `<Scripts>` components.

Let's consider building some breadcrumbs. If a route wants to participate in these breadcrumbs at the top of the root layout, it normally can't because it renders down low in the tree.

You can put whatever you want on a route `handle`. Here we'll use `breadcrumb`. It's not a Remix thing, it's whatever you want. Here it's added to a parent route:

1. Add the breadcrumb handle to the parent route

   ```tsx
   // routes/parent.tsx
   export const handle = {
     breadcrumb: () => <Link to="/parent">Some Route</Link>,
   };
   ```

2. We can do the same for a child route

   ```tsx
   // routes/parent/child.tsx
   export const handle = {
     breadcrumb: () => (
       <Link to="/parent/child">Child Route</Link>
     ),
   };
   ```

3. Now we can put it all together in our root route with `useMatches`.

   ```tsx [6, 20-31]
   // root.tsx
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

For an example of how to share loader data via `useMatches`, check out [the sharing loader data example in the `remix-run/remix` repo][example-sharing-loader-data].

## `useBeforeUnload`

This hook is just a helper around `window.onbeforeunload`.

When users click links to pages they haven't visited yet, Remix loads the code-split modules for that page. If you deploy in the middle of a user's session, and you or your host removes the old files from the server (many do 😭), then Remix's requests for those modules will fail. Remix recovers by automatically reloading the browser at the new URL. This should start over from the server with the latest version of your application. Most of the time this works out great, and user doesn't even know anything happened.

In this situation, you may need to save important application state on the page (to something like the browser's local storage), because the automatic page reload will lose any state you had.

Remix or not, this is a good practice. The user can change the url, accidentally close the browser window, etc.

```tsx lines=[1,7-11]
import { useBeforeUnload } from "@remix-run/react";

function SomeForm() {
  const [state, setState] = React.useState(null);

  // save it off before the automatic page reload
  useBeforeUnload(
    React.useCallback(() => {
      localStorage.stuff = state;
    }, [state])
  );

  // read it in when they return
  React.useEffect(() => {
    if (state === null && localStorage.stuff != null) {
      setState(localStorage.stuff);
    }
  }, [state]);

  return <>{/*... */}</>;
}
```

## `<Outlet context />`

This component is a wrapper around React Router's Outlet with the ability to pass UI state down to nested routes.

<docs-warning>You can use this for loader data, but you don't need to. It's easier to access all loader data in any component via [`useLoaderData`](#useloaderdata) or [`useMatches`](#usematches).</docs-warning>

Here's a practical example of when you may want to use this feature. Let's say you've got a list of companies that have invoices and you want to display those companies in an accordion. We'll render our outlet in that accordion, but we want the invoice sorting to be controlled by the parent (so changing companies preserves the invoice sorting). This is a perfect use case for `<Outlet context>`.

```tsx filename=app/routes/companies.tsx lines=[5,28-31,36-44,53-57,68]
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useParams,
  Outlet,
} from "@remix-run/react";
import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
} from "@reach/accordion";

import type { Companies } from "~/utils/companies";
import { getCompanies } from "~/utils/companies";

type LoaderData = {
  companies: Array<Companies>;
};

export const loader: LoaderFunction = async () => {
  const data: LoaderData = {
    companies: await getCompanies(),
  };
  return json(data);
};

type Sort = "ASC" | "DESC";
export type ContextType = {
  invoiceSort: Sort;
};

export default function CompaniesRoute() {
  const data = useLoaderData<LoaderData>();

  const [invoiceSort, setInvoiceSort] =
    React.useState<Sort>("ASC");
  function changeInvoiceSort() {
    setInvoiceSort((sort) =>
      sort === "ASC" ? "DESC" : "ASC"
    );
  }
  const context: ContextType = { invoiceSort };
  const outlet = <Outlet context={context} />;

  const params = useParams();
  const selectedCompanyIndex = data.companies.findIndex(
    (company) => company.id === params.companyId
  );

  return (
    <div>
      <button onClick={changeInvoiceSort}>
        {invoiceSort === "ASC"
          ? "Sort Descending"
          : "Sort Ascending"}
      </button>
      <Accordion index={selectedCompanyIndex}>
        {data.companies.map((company) => (
          <AccordionItem key={company.id}>
            <AccordionButton as={Link} to={company.id}>
              {company.name}
            </AccordionButton>
            {/* render the outlet by the
            currently selected company */}
            <AccordionPanel>
              {params.companyId === company.id
                ? outlet
                : null}
            </AccordionPanel>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
```

## `useOutletContext()`

This hook returns the context from the `<Outlet />` that rendered you.

Continuing from the `<Outlet context />` example above, here's what the child route could do to use the sort order.

```tsx filename=app/routes/companies/$companyId.tsx lines=[5,8,25,27-30]
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useOutletContext,
} from "@remix-run/react";

import type { ContextType } from "../companies";

type LoaderData = {
  company: Company;
};

export const loader: LoaderFunction = async ({
  params,
}) => {
  const data: LoaderData = {
    company: await getCompany(params.companyId),
  };
  return json(data);
};

export default function CompanyRoute() {
  const data = useLoaderData<LoaderData>();
  const { invoiceSort } = useOutletContext<ContextType>();

  const sortedInvoices =
    invoiceSort === "ASC"
      ? data.company.invoices
      : data.company.invoices.reverse();

  return (
    <div>
      <h2>{data.company.name}</h2>
      <ul>
        {sortedInvoices.map((invoice) => (
          <li key={invoice.id}>{invoice.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

[form]: #form
[usefetcher]: #usefetcher
[usetransition]: #usetransition
[useactiondata]: #useactiondata
[useloaderdata]: #useloaderdata
[usesubmit]: #usesubmit
[action]: #form-action
[disabling-javascript]: ../guides/disabling-javascript
[example-sharing-loader-data]: https://github.com/remix-run/remix/tree/main/examples/sharing-loader-data
