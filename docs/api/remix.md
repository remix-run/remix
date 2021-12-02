---
title: Remix Package
order: 2
---

# Remix Package

This package provides all the components, hooks, and [Web Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) objects and helpers.

## Components and Hooks

### `<Meta>`, `<Links>`, `<Scripts>`

These components are to be used once inside of your root route (`root.tsx`). They include everything Remix figured out or built in order for your page to render properly.

```tsx [2,10,11,15]
import React from "react";
import { Meta, Links, Scripts, Outlet } from "remix";

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

You can pass extra props to `<Scripts/>` like `<Scripts crossOrigin>` for hosting your static assets on a different server than your app, or `<Script nonce={nonce}/>` for certain content security policies.

### `<Link>`

This component renders an anchor tag and is the primary way the user will navigate around your website. Anywhere you would have used `<a href="...">` you should now use `<Link to="..."/>` to get all the performance benefits of client-side routing in Remix.

It wraps React Router's Link with some extra behavior around resource prefetching.

```tsx
import { Link } from "remix";

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
<Link /> // defaults to "none"
<Link prefetch="none" />
<Link prefetch="intent" />
<Link prefetch="render" />
```

- **"none"** - Default behavior. This will prevent any prefetching from happening. This is recommended when linking to pages that require a user session that the browser won't be able to prefetch anyway.
- **"intent"** - Recommended if you want to prefetch. Fetches when when Remix thinks the user intends to visit the link. Right now the behavior is simple: if they hover or focus the link it will prefetch the resources. In the future we hope to make this event smarter. Links with large click areas/padding get a bit of a head start.
- **"render"** - Fetches when the link is rendered.

<docs-error>You may need to use the <code>:last-of-type</code> selector instead of <code>:last-child</code> when styling child elements inside of your links</docs-error>

Remix uses the browser's cache for prefetching with HTML `<link rel="prefetch"/>` tags, which provides a lot subtle benefits (like respecting HTTP cache headers, doing the work in browser idle time, using a different thread than your app, etc.) but the implementation might mess with your CSS since the link tags are rendered inside of your anchor tag. This means `a *:last-child {}` style selectors won't work. You'll need to change them to `a *:last-of-type {}` and you should be good. We will eventually get rid of this limitation.

### `<NavLink>`

A `<NavLink>` is a special kind of `<Link>` that knows whether or not it is "active". This is useful when building a navigation menu, such as a breadcrumb or a set of tabs where you'd like to show which of them is currently selected. It also provides useful context for assistive technology like screen readers.

### `<Form>`

The `<Form>` component is a declarative way to perform data mutations: creating, updating, and deleting data. While it might be a mindshift to think about these tasks as "navigation", it's how the web has handled mutations since before JavaScript was created!

```js
import { Form } from "remix";

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

#### `<Form action>`

Most of the time you can omit this prop. Forms without an action prop (`<Form method="post">`) will automatically post to the same route within which they are rendered. This makes colocating your component, your data reads, and your data writes a snap.

If you need to post to a different route, then add an action prop:

```js
<Form action="/projects/new" method="post" />
```

When a POST is made to a URL, multiple routes in your route hierarchy will match the URL. Unlike a GET to loaders, where all of them are called to build the UI, _only one action is called_. The route called will be the deepest matching route, unless the deepest matching route is an "index route". In this case, it will post to the parent route of the index route (because they share the same URL).

If you want to post to an index route use `?index` in the action: `<Form action="/accounts?index" method="post" />`

| action url        | route action               |
| ----------------- | -------------------------- |
| `/accounts?index` | `routes/accounts/index.js` |
| `/accounts`       | `routes/accounts.js`       |

#### `<Form method>`

This determines the [HTTP verb](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods) to be used: get, post, put, patch, delete. The default is "get".

```js
<Form method="post" />
```

Native `<form>` only supports get and post, so if you want your form to work with JavaScript on or off the page you'll need to stick with those two.

Without JavaScript, Remix will turn non-get requests into "post", but you'll still need to instruct your server with a hidden input like `<input type="hidden" name="_method" value="delete" />`. If you always include JavaScript, you don't need to worry about this.

<docs-info>We generally recommend sticking with "get" and "post" because the other verbs are not supported by HTML</docs-info>

#### `<Form encType>`

Defaults to `application/x-www-urlencoded`, which is also the only supported value right now.

#### `<Form replace>`

```tsx
<Form replace />
```

Instructs the form to replace the current entry in the history stack, instead of pushing the new entry. If you expect a form to be submitted multiple times you may not want the user to have to click "back" for every submission to get to the previous page.

<docs-warning>This has no effect without JavaScript on the page.</docs-warning>

#### `<Form reloadDocument>`

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

### `<ScrollRestoration>`

This component will emulate the browser's scroll restoration on location changes. Hopefully you never notice this component at all!

It must be the last element on the page, right before the `<Scripts/>` tag:

```tsx [4,5]
<html>
  <body>
    {/* ... */}
    <ScrollRestoration />
    <Scripts />
  </body>
</html>
```

In order to avoid (usually) the client-side routing "scroll flash" on refresh or clicking back into the app from a different domain, this component attempts to restore scroll _before React hydration_. If you render the script anywhere other than the bottom of the document the window will not be tall enough to restore to the correct position.

### `useLoaderData`

This hook returns the JSON parsed data from your route loader function.

```tsx [2,9]
import React from "react";
import { useLoaderData } from "remix";

export function loader() {
  return fakeDb.invoices.findAll();
}

export default function Invoices() {
  const invoices = useLoaderData();
  // ...
}
```

### `useActionData`

This hook returns the JSON parsed data from your route action. It returns `undefined` if there hasn't been a submission at the current location yet.

```tsx [2,11,20]
import React from "react";
import { useActionData } from "remix";

export async function action({ request }) {
  const body = await request.formData();
  const name = body.get("visitorsName");
  return { message: `Hello, ${name}` };
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
      <p>{data ? data.message : "Waiting..."}</p>;
    </Form>
  );
}
```

The most common use-case for this hook is form validation errors. If the form isn't right, you can simply return the errors and let the user try again (instead of pushing all the errors into sessions and back out of the loader).

```tsx [21, 30, 38-40, 44-46]
import { redirect, json, Form, useActionData } from "remix";

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
  await createUser(body);
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

#### Notes about resubmissions

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

Usually your actions will either return validation issues or redirect, and then you're data and your user's are safe no matter how the form is submitted. But to go into further detail, if you're using:

- `<form>`
- `<Form reloadDocument>`
- You're not rendering `<Scripts/>`
- The user has JavaScript disabled

The browser will resubmit the form in these situations unless you redirect from the action. If these are cases you want to support, we recommend you follow the age-old best practice of redirecting from actions.

If you're using `<Form>` and don't care to support the cases above, you don't need to redirect from your actions. However, if you don't redirect from an action, make sure reposting the same information isn't dangerous to your data or your visitors because you can't control if they have JavaScript enabled or not.

<docs-info>In general, if the form validation fails, return data from the action and render it in the component, but once you actually change data (in your database, or otherwise) you should redirect.</docs-info>

See also:

- [`action`][action]
- [`useTransition`][usetransition]

### `useFormAction`

Resolves the value of a `<form action>` attribute using React Router's relative paths. This can be useful when computing the correct action for a `<button formAction>`, for example, when a `<button>` changes the action of its `<form>`.

```tsx
<button
  formAction={useFormAction("destroy")}
  formMethod="DELETE"
>
  Delete
</button>
```

(Yes, HTML buttons can change the action of their form!)

### `useSubmit`

Returns the function that may be used to submit a `<form>` (or some raw `FormData`) to the server using the same process that `<Form>` uses internally `onSubmit`. If you're familiar with React Router's `useNavigate`, you can think about this as the same thing but for `<Form>` instead of `<Link>`.

This is useful whenever you need to programmatically submit a form. For example, you may wish to save a user preferences form whenever any field changes.

```tsx filename=app/routes/prefs.tsx lines=[1,13,17]
import { useSubmit, useTransition } from "remix";

export async function loader() {
  await getUserPreferences();
}

export async function action() {
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

This can also be useful if you'd like to automatically sign someone out of your website after a period of inactivity. In this case we've defined inactivity as the user hasn't navigated to any other pages after 5 minutes.

```tsx [1,10,15]
import { useSubmit, useTransition } from "remix";
import { useEffect } from "react";

function AdminPage() {
  useSessionTimeout();
  return <div>{/* ... */}</div>;
}

function useSessionTimeout() {
  const submit = useSubmit();
  const transition = useTransition();

  useEffect(() => {
    const id = setTimeout(() => {
      submit(null, { method: "post", action: "/logout" });
    }, 5 * 60_000);
    return () => clearTimeout(timer);
  }, [transition]);
}
```

### `useTransition`

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
  const transition = useTransition();
  transition.state;
  transition.type;
  transition.submission;
  transition.location;
}
```

#### `transition.state`

You can know the state of the transition with `transition.state`, it will be one of:

- **idle** - There is no transition pending.
- **submitting** - A form has been submitted, if GET, then the route loader is being called, if POST, PUT, PATCH, DELETE, then the route action is being called.
- **loading** - The loaders for the next routes are being called to render the next page.

Normal navigations transition as follows:

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
    : transition.state === "submitting"
    ? "Saving..."
    : transition.state === "loading"
    ? "Saved!"
    : "Go"

  return <button type="submit">{text}</button>;
}
```

#### `transition.type`

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
    actionReload: "Data saved, reloading fresh data..."
  };

  const text =
    transition.state === "submitting"
      ? "Saving..."
      : transition.state === "loading"
      ? loadTexts[transition.type] || "Loading..."
      : "Go";

  return <button type="submit"></button>;
}
```

#### `transition.submission`

Any transition that started from a `<Form>` or `useSubmit` will have your form's submission attached to it. This is primarily useful to build "Optimistic UI" with the `submission.formData` [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) object.

TODO: Example

#### `transition.location`

This tells you what the next location is going to be. Its most useful when matching against the next URL for custom links and hooks.

For example, this `Link` knows when it's page is loading and it's about to become active:

```tsx [6-8]
import { Link, useResolvedPath } from "remix";

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

Note that this link will not appear "pending" if a form is being submitted to the URL the link points to because we only do this for "loading" states. The form will contain the pending UI for whie the state is "submitting", once the action is complete, then the link will go pending.

### `useFetcher`

<docs-error>This hook is for advanced cases that most features of your app don't need. It does not work with server rendering, usually requires JavaScript in the browser, and requires you to deal with pending states.</docs-error>

It is common for Remix newcomers to see this hook and think it is the primary way to interact with the server for data loading and updates, but it is not! Remix was specifically designed to avoid this type of interaction with the server and has better ways of handling typical data loading and updating workflows, you probably want one of these:

- [`useLoaderData`][useloaderdata]
- [`Form`][form]
- [`useActionData`][useactiondata]
- [`useTransition`][usetransition]

This hook will call loaders and actions without navigating. It's similar to `useFetch()` wrappers found in many React apps but with extra behavior specific to Remix (like capturing data updates automatically across the whole page).

```tsx
import { useFetcher } from "remix";

function SomeComponent() {
  const fetcher = useFetcher();

  // trigger the fetch with these
  <fetcher.Form {..formOptions} />;
  fetcher.submit(data, options);
  fetcher.load(href);

  // build UI with these
  fetcher.state;
  fetcher.type;
  fetcher.submission;
  fetcher.data;
}
```

In HTML/HTTP, data mutations and loads are modeled with navigation: `<a href>` and `<form action>` both cause a navigation in the browser. The remix equivalents are `<Link>` and `<Form>`.

In Remix, when the user submits a `<Form>` the action is called and then the loaders for the routes on the page are called again to get fresh data.

But sometimes you want to call an action to update data (and get the routes to reload) but you don't want the URL to change. Many interactions with the server aren't navigation events. This hook lets you plug your UI into your actions and loaders without navigating.

Notes about how it works:

- Automatically handles cancellation of the fetch at the browser level
- When submitting with POST, PUT, PATCH, DELETE, the action is called first
  - After the action completes, the loaders on the page are reloaded to capture any mutations that may have happened, automatically keeping your UI in sync with your server state
- When multiple fetchers are inflight at once, it will
  - commit the freshest available data as they each land
  - ensure no stale loads overrite fresher data, no matter which order the responses return
- Handles uncaught errors by rendering the nearest `ErrorBoundary` (just like a normal navigation from `<Link>` or `<Form>`)
- Will redirect the app if your action/loader being called returns a redirect (just like a normal navigation from `<Link>` or `<Form>`)

#### `fetcher.state`

You can know the state of the fetcher with `fetcher.state`, it will be one of:

- **idle** - nothing is being fetched
- **submitting** - A form has been submitted. If the method is GET then the route loader is being called, if POST, PUT, PATCH, or DELETE then the route action is being called.
- **loading** - The loaders for the routes are being reloaded after an action submission completed.

#### `fetcher.type`

This is the type of state the fetcher is in. It's like `fetcher.state` but more granular. Depending on the fetcher's state, the types can be the following:

- `state === "idle"`

  - **init** - The fetcher isn't doing anything currently and hasn't done anything yet.
  - **done** - The fetcher isn't doing anything currently, but it has completed a fetch and you can safely read the `fetcher.data`.

- `state === "submitting"`

  - **actionSubmission** - A form has been submitted with POST, PUT, PATCH, or DELETE, and the action is being called.
  - **loaderSubmission** - A form has been submitted with GET and the loader is being called

- `state === "loading"`

  - **actionReload** - The action from an "actionSubmission" returned data and the loaders on the page are being reloaded.
  - **load** - A route's loader is being called without a submission (`fetcher.load()`)

#### `fetcher.submission`

When using `<fetcher.Form>` or `fetcher.submit()`, the form submission is available to build optimistic UI.

It is not available when the fetcher state is "idle" or "loading".

#### `fetcher.data`

When using `<fetcher.Form>` or `fetcher.submit()`, the action or loader's response is stored here.

In the case of action submissions, the data is available even before the routes on the page are reloaded.

It is not available when the fetcher state is "submitting". If you need it around when the same form is resubmit, you'll need to persist it to your own React state.

#### `fetcher.Form`

Just like `<Form>` except it doesn't cause a navigation. (You'll get over the dot in JSX, don't worry.)

```tsx
function SomeComp() {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post" action="/some/route">
      <input type="text" />
    </fetcher.Form>
  );
}
```

#### `fetcher.submit()`

Just like `useSubmit` except it doesn't cause a navigation.

```tsx
const fetcher = useFetcher();
fetcher.submit({ some: "values" }, { method: "post" });
```

#### `fetcher.load()`

Loads data from a route loader.

```tsx
const fetcher = useFetcher();
fetcher.load("/some/route");
fetcher.data; // the data from the loader
```

#### Examples

**Newsletter Signup Form**

Perhaps you have a persistent newsletter signup at the bottom of every page on your site. This is not a navigation event, so useFetcher is perfect for the job:

```tsx
// routes/newsletter/subscribe.js
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

```tsx
// NewsletterSignup.js
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

```tsx
// routes/newsletter/subscribe.js
export function action({ request }) {
  // just like before
}

export default function NewsletterSignupRoute() {
  const data = useActionData();
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

```tsx
// NewsletterSignup.js
import { Form, useFetcher } from "remix";

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
  type
}) {
  // refactor a bit in here, just read from props instead of useFetcher
}
```

And now you could reuse the same form, but it gets data from a different hook for the no-js experience:

```tsx
// routes/newsletter/subscribe.js
import { NewsletterForm } from "~/NewsletterSignup";
import { Form } from "remix";

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
        method: "POST",
        action: "/article/${articleID}/mark-as-read"
      }
    );
  });
}
```

**User Avatar Details Popup**

Anytime you show the user avatar, you could put a hover effect that fetches data from a loader and displays it in a popup.

```tsx
// routes/user/$id/details.js
export function loader({ params }) {
  return fakeDb.user.find({ where: { id: params.id } });
}
```

```tsx
// UserAvatar.js
function UserAvatar({ partialUser }) {
  const userDetails = useFetcher();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (showDetails && userDetails.type === "init") {
      userDetails.load(`/users/${user.id}/details`);
    }
  }, [showDetails]);

  return (
    <div
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <img src={partialUser.profileImageUrl} />
      {showDetails &&
        (userDetails.type === "done" ? (
          <UserPopup user={userDetails.data} />
        ) : (
          <UserPopupLoading />
        ))}
    </div>
  );
}
```

**Async Reach UI Combobox**

If the user needs to select a city, you could have a loader that returns a list of cities based on a query and plug it into a Reach UI combobox:

```tsx
// routes/city-search.tsx
export function loader({ request }) {
  const url = new URL(request.url);
  return searchCities(url.searchParams.get("city-query"));
}
```

```tsx
function CitySearchCombobox() {
  const cities = useFetcher();

  return (
    <cities.Form method="get" action="/city-search">
      <Combobox aria-label="Cities">
        <div>
          <ComboboxInput
            name="city-query"
            onChange={event =>
              cities.submit(event.target.form)
            }
          />
          {cities.state === "submitting" && <Spinner />}
        </div>

        {cities.data && (
          <ComboboxPopover className="shadow-popup">
            {cities.data.error ? (
              <p>Failed to load cities :(</p>
            ) : cities.data.length ? (
              <ComboboxList>
                {cities.data.map(city => (
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
        )}
      </Combobox>
    </cities.Form>
  );
}
```

### `useFetchers`

Returns an array of all inflight fetchers.

This is useful for components throughout the app that didn't create the fetchers but want to use their submissions to participate in optimistic UI.

For example, imagine a UI where the sidebar lists projects and the main view displays a list of checkboxes for the current project. The sidebar could display the number of completed and total tasks for each project.

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
          onChange={e => toggle.submit(e.target.form)}
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

This is where `useFetchers` comes in. Up in the sidebar we can get access too all of the inflight fetcher states from the checkboxes--even though it's not the component that created them.

The strategy has three steps:

1. Find the submissions for tasks in a specific project
2. Use the `fetcher.submission.formData` to immediately update the count
3. Use the normal task's state if it's not inflight

Here's some sample code:

```js
function ProjectTaskCount({ project }) {
  const fetchers = useFetchers();
  const completedTasks = 0;

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

### `useMatches`

Returns the current route matches on the page. This is useful for creating layout abstractions with your current routes.

```js
const matches = useMatches();
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

Pairing route `handle` with `useMatches`, you can build your own, similar conventions to Remix's built-in `<Meta>`, `<Links>`, and `<Scripts>` components.

Let's consider building some breadcrumbs. If a route wants to participate in these breadcrumbs at the top of the root layout, it normally can't because it renders down low in the tree.

You can put whatever you want on a route `handle`, here we'll use `breadcrumb`, it's not a Remix thing, it's whatever you want. Here it's added to a parent route:

1. Add the breadcrumb handle to the parent route

   ```tsx
   // routes/parent.tsx
   export const handle = {
     breadcrumb: () => <Link to="/parent">Some Route</Link>
   };
   ```

2. We can do the same for a child route

   ```tsx
   // routes/parent/child.tsx
   export const handle = {
     breadcrumb: () => (
       <Link to="/parent/child">Child Route</Link>
     )
   };
   ```

3. Now we can put it all together in our root route with `useMatches`.

   ```tsx [6, 21-32]
   // root.tsx
   import {
     Links,
     Scripts,
     useLoaderData,
     useMatches
   } from "remix";

   export default function Root() {
     const matches = useMatches();

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
                   match =>
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

### `useBeforeUnload`

This hook is just a helper around `window.onbeforeunload`.

When users click links to pages they haven't visited yet, Remix loads the code-split modules for that page. If you deploy in the middle of a user's session, and you or your host removes the old files from the server (many do 😭) then Remix's requests for those modules will fail. Remix recovers by automatically reloading the browser at the new URL. This should start over from the server with the latest version of your application. Most of the time this works out great and user doesn't even know anything happened.

In this situation, you may need to save important application state on the page (to something like the browser's local storage) because the automatic page reload will lose any state you had.

Remix or not, this is just good practice to do. The user can change the url, accidentally close the browser window, etc.

```tsx [1,7-11]
import { useBeforeUnload } from "remix";

function SomeForm() {
  const [state, setState] = React.useState(null);

  // save it off before the automatic page reload
  useBeforeUnload(
    React.useCallback(() => {
      localStorage.stuff = state
    }, [state])
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

## HTTP Helpers

### `json`

This is a shortcut for creating `application/json` responses. It assumes you are using `utf-8` encoding.

```ts [2,6]
import type { LoaderFunction } from "remix";
import { json } from "remix";

export const loader: LoaderFunction = () => {
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
export const loader: LoaderFunction = () => {
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

### `redirect`

This is shortcut for sending 30x responses.

```ts [2,8]
import type { ActionFunction } from "remix";
import { redirect } from "remix";

export const action: ActionFunction = async () => {
  const userSession = await getUserSessionOrWhatever();

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
return new Response(null, {
  status: 303,
  headers: {
    Location: "/else/where"
  }
});
```

## Cookies

A [cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) is a small piece of information that your server sends someone in a HTTP response that their browser will send back on subsequent requests. This technique is a fundamental building block of many interactive websites that adds state so you can build authentication (see [sessions][sessions]), shopping carts, user preferences, and many other features that require remembering who is "logged in".

Remix's `Cookie` interface provides a logical, reusable container for cookie metadata.

### Using cookies

While you may create these cookies manually, it is more common to use a [session storage][sessions].

In Remix, you will typically work with cookies in your `loader` and/or `action` functions (see <Link to="../mutations">mutations</Link>) since those are the places where you need to read and write data.

Let's say you have a banner on your e-commerce site that prompts users to check out the items you currently have on sale. The banner spans the top of your homepage, and includes a button on the side that allows the user to dismiss the banner so they don't see it for at least another week.

First, create a cookie:

```js filename=app/cookies.js
import { createCookie } from "remix";

export const userPrefs = createCookie("user-prefs", {
  maxAge: 604_800 // one week
});
```

Then, you can `import` the cookie and use it in your `loader` and/or `action`. The `loader` in this case just checks the value of the user preference so you can use it in your component for deciding whether or not to render the banner. When the button is clicked, the `<form>` calls the `action` on the server and reloads the page without the banner.

**Note:** We recommend (for now) that you create all the cookies your app needs in `app/cookies.js` and `import` them into your route modules. This allows the Remix compiler to correctly prune these imports out of the browser build where they are not needed. We hope to eventually remove this caveat.

```js filename=app/routes/index.js lines=[2,6,14,18]
import { useLoaderData, json, redirect } from "remix";
import { userPrefs } from "~/cookies";

export async function loader({ request }) {
  const cookieHeader = request.headers.get("Cookie");
  const cookie =
    (await userPrefs.parse(cookieHeader)) || {};
  return { showBanner: value.showBanner };
}

export async function action({ request }) {
  const cookieHeader = request.headers.get("Cookie");
  const cookie =
    (await userPrefs.parse(cookieHeader)) || {};
  const bodyParams = await request.formData();

  if (bodyParams.get("banner") === "hidden") {
    cookie.showBanner = false;
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": await userPrefs.serialize(cookie)
    }
  });
}

export default function Home() {
  const { showBanner } = useLoaderData();

  return (
    <div>
      {showBanner && (
        <div>
          <Link to="/sale">Don't miss our sale!</Link>
          <Form method="post">
            <input
              type="hidden"
              name="bannerVisibility"
              value="hidden"
            />
            <button type="submit">Hide</button>
          </Form>
        </div>
      )}
      <h1>Welcome!</h1>
    </div>
  );
}
```

### Cookie attributes

Cookies have [several attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes) that control when they expire, how they are accessed, and where they are sent. Any of these attributes may be specified either in `createCookie(name, options)`, or during `serialize()` when the `Set-Cookie` header is generated.

```js
const cookie = createCookie("user-prefs", {
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

### Signing cookies

It is possible to sign a cookie to automatically verify its contents when it is received. Since it's relatively easy to spoof HTTP headers, this is a good idea for any information that you do not want someone to be able to fake, like authentication information (see [sessions][sessions]).

To sign a cookie, provide one or more `secrets` when you first create the cookie:

```js
const cookie = createCookie("user-prefs", {
  secrets: ["s3cret1"]
});
```

Cookies that have one or more `secrets` will be stored and verified in a way that ensures the cookie's integrity.

Secrets may be rotated by adding new secrets to the front of the `secrets` array. Cookies that have been signed with old secrets will still be decoded successfully in `cookie.parse()`, and the newest secret (the first one in the array) will always be used to sign outgoing cookies created in `cookie.serialize()`.

```js
// app/cookies.js
const cookie = createCookie("user-prefs", {
  secrets: ["n3wsecr3t", "olds3cret"]
});

// in your route module...
export async function loader({ request }) {
  const oldCookie = request.headers.get("Cookie");
  // oldCookie may have been signed with "olds3cret", but still parses ok
  const value = await cookie.parse(oldCookie);

  new Response("...", {
    headers: {
      // Set-Cookie is signed with "n3wsecr3t"
      "Set-Cookie": await cookie.serialize(value)
    }
  });
}
```

### `createCookie`

Creates a logical container for managing a browser cookie from there server.

```ts
import { createCookie } from "remix";

const cookie = createCookie("cookie-name", {
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

### `isCookie`

Returns `true` if an object is a Remix cookie container.

```ts
import { isCookie } from "remix";
const cookie = createCookie("user-prefs");
console.log(isCookie(cookie));
// true
```

### Cookie API

A cookie container is returned from `createCookie` and has handful of properties and methods.

```ts
const cookie = createCookie(name);
cookie.name;
cookie.parse();
// etc.
```

#### `cookie.name`

The name of the cookie, used in `Cookie` and `Set-Cookie` HTTP headers.

#### `cookie.parse()`

Extracts and returns the value of this cookie in a given `Cookie` header.

```js
const value = await cookie.parse(
  request.headers.get("Cookie")
);
```

#### `cookie.serialize()`

Serializes a value and combines it with this cookie's options to create a `Set-Cookie` header, suitable for use in an outgoing `Response`.

```js
new Response("...", {
  headers: {
    "Set-Cookie": await cookie.serialize({
      showBanner: true
    })
  }
});
```

#### `cookie.isSigned`

Will be `true` if the cookie uses any `secrets`, `false` otherwise.

```js
const cookie = createCookie("user-prefs");
console.log(cookie.isSigned); // false

cookie = createCookie("user-prefs", {
  secrets: ["soopersekrit"]
});
console.log(cookie.isSigned); // true
```

#### `cookie.expires`

The `Date` on which this cookie expires. Note that if a cookie has both `maxAge` and `expires`, this value will the date at the current time plus the `maxAge` value since `Max-Age` takes precedence over `Expires`.

```js
const cookie = createCookie("user-prefs", {
  expires: new Date("2021-01-01")
});

console.log(cookie.expires); // "2020-01-01T00:00:00.000Z"
```

## Sessions

Sessions are an important part of websites that allow the server to identify requests coming from the same person, especially when it comes to server-side form validation or when JavaScript is not on the page. Sessions are a fundamental building block of many sites that let users "log in", including social, e-commerce, business, and educational websites.

In Remix, sessions are managed on a per-route basis (rather than something like express middleware) in your `loader` and `action` methods using a "session storage" object (that implements the `SessionStorage` interface). Session storage understands how to parse and generate cookies, and how to store session data in a database or filesystem.

Remix comes with several pre-built session storage options for common scenarios and one to create your own:

- `createCookieSessionStorage`
- `createMemorySessionStorage`
- `createFileSessionStorage` (node)
- `createCloudflareKVSessionStorage` (cloudflare-workers)
- custom storage with `createSessionStorage`

### Using Sessions

This is an example of a cookie session storage:

```js filename=app/sessions.js
// app/sessions.js
import { createCookieSessionStorage } from "remix";

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage({
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

We recommend setting up your session storage object in `app/sessions.js` so all routes that need to access session data can import from the same spot (also, see our [Route Module Constraints][constraints]).

The input/output to a session storage object are HTTP cookies. `getSession()` retrieves the current session from the incoming request's `Cookie` header, and `commitSession()`/`destroySession()` provide the `Set-Cookie` header for the outgoing response.

You'll use methods to get access to sessions in your `loader` and `action` functions.

A login form might look something like this:

```tsx filename=app/routes/login.js lines=2,5-7,9,14,18,24-26,37,42,47,52
import { json, redirect } from "remix";
import { getSession, commitSession } from "../sessions";

export async function loader({ request }) {
  const session = await getSession(
    request.headers.get("Cookie")
  );

  if (session.has("userId")) {
    // Redirect to the home page if they are already signed in.
    return redirect("/");
  }

  const data = { error: session.get("error") };

  return json(data, {
    headers: {
      "Set-Cookie": await commitSession(session)
    }
  });
}

export async function action({ request }) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");

  const userId = await validateCredentials(
    username,
    password
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
  const { currentUser, error } = useLoaderData();

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

And then a logout form might look something like this:

```tsx
import { getSession, destroySession } from "../sessions";

export const action: ActionFunction = async ({
  request
}) => {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  return redirect("/login", {
    headers: { "Set-Cookie": await destroySession(session) }
  });
};

export default function LogoutRoute() {
  return (
    <>
      <p>Are you sure you want to log out?</p>
      <Form method="post">
        <button>Logout</button>
      </Form>
      <Link to="/">Nevermind</Link>
    </>
  );
}
```

<docs-warning>It's important that you logout (or perform any mutation for that matter) in an `action` and not a `loader`. Otherwise you open your users to [Cross-Site Request Forgery](https://developer.mozilla.org/en-US/docs/Glossary/CSRF) attacks. Also, Remix only re-calls `loaders` when `actions` are called.</docs-warning>

### Session Gotchas

Because of nested routes, multiple loaders can be called to construct a single page. When using `session.flash()` or `session.unset()`, you need to be sure no other loaders in the request are going to want to read that, otherwise you'll get race conditions. Typically if you're using flash, you'll want to have a single loader read it, if another loader wants a flash message, use a different key for that loader.

### `createSession`

TODO:

### `isSession`

TODO:

### `createSessionStorage`

Remix makes it easy to store sessions in your own database if needed. The `createSessionStorage()` API requires a `cookie` (or options for creating a cookie, see [cookies][cookies]) and a set of create, read, update, and delete (CRUD) methods for managing the session data. The cookie is used to persist the session ID.

The following example shows how you could do this using a generic database client:

```js
import { createSessionStorage } from "remix";

function createDatabaseSessionStorage({
  cookie,
  host,
  port
}) {
  // Configure your database client...
  const db = createDatabaseClient(host, port);

  return createSessionStorage({
    cookie,
    async createData(data, expires) {
      // `expires` is a Date after which the data should be considered
      // invalid. You could use it to invalidate the data somehow or
      // automatically purge this record from your database.
      const id = await db.insert(data);
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
const { getSession, commitSession, destroySession } =
  createDatabaseSessionStorage({
    host: "localhost",
    port: 1234,
    cookie: {
      name: "__session",
      sameSite: "lax"
    }
  });
```

The `expires` argument to `readData` and `updateData` is the same `Date` at which the cookie itself expires and is no longer valid. You can use this information to automatically purge the session record from your database to save on space, or to ensure that you do not otherwise return any data for old, expired cookies.

### `createCookieSessionStorage`

For purely cookie-based sessions (where the session data itself is stored in the session cookie with the browser, see [cookies][cookies]) you can use `createCookieSessionStorage()`.

The main advantage of cookie session storage is that you don't need any additional backend services or databases to use it. It can also be beneficial in some load balanced scenarios. However, cookie-based sessions may not exceed the browser's max allowed cookie length (typically 4kb).

The downside is that you have to `commitSession` in almost every loader and action. If your loader or action changes the session at all, it must be committed. That means if you `session.flash` in an action, and then `session.get` in another, you must commit it for that flashed message to go away. With other session storage strageties you only have to commit it when it's created (the browser cookie doesn't need to change because it doesn't store the session data, just the key to find it elsewhere).

```js
import { createCookieSessionStorage } from "remix";

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage({
    // a Cookie from `createCookie` or the same CookieOptions to create one
    cookie: {
      name: "__session",
      secrets: ["r3m1xr0ck5"],
      sameSite: "lax"
    }
  });
```

### `createMemorySessionStorage`

This storage keeps all the cookie information in your server's memory.

<docs-error>This should only be used in development. Use one of the other methods in production.</docs-error>

```js
// app/sessions.js
import {
  createCookie,
  createFileSessionStorage
} from "remix";

// In this example the Cookie is created separately.
const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true
});

const { getSession, commitSession, destroySession } =
  createFileSessionStorage({
    // The root directory where you want to store the files.
    // Make sure it's writable!
    dir: "/app/sessions",
    cookie: sessionCookie
  });

export { getSession, commitSession, destroySession };
```

### `createFileSessionStorage` (node)

For file-backed sessions, use `createFileSessionStorage()`. File session storage requires a file system, but this should be readily available on most cloud providers that run express, maybe with some extra configuration.

The advantage of file-backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a regular file on disk, ideal for sessions with more than 4kb of data.

<docs-info>If you are deploying to a serverless function, ensure you have access to a persistent file system. They usually don't have one without extra configuration.</docs-info>

```js
// app/sessions.js
import {
  createCookie,
  createFileSessionStorage
} from "remix";

// In this example the Cookie is created separately.
const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true
});

const { getSession, commitSession, destroySession } =
  createFileSessionStorage({
    // The root directory where you want to store the files.
    // Make sure it's writable!
    dir: "/app/sessions",
    cookie: sessionCookie
  });

export { getSession, commitSession, destroySession };
```

### `createCloudflareKVSessionStorage` (cloudflare-workers)

For [Cloudflare KV](https://developers.cloudflare.com/workers/learning/how-kv-works) backed sessions, use `createCloudflareKVSessionStorage()`.

The advantage of KV backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a globaly replicated, low-latency data store with exceptionally high read volumes with low-latency.

```js
// app/sessions.js
import {
  createCookie,
  createCloudflareKVSessionStorage
} from "remix";

// In this example the Cookie is created separately.
const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true
});

const { getSession, commitSession, destroySession } =
  createCloudflareKVSessionStorage({
    // The KV Namespace where you want to store sessions
    kv: YOUR_NAMESPACE,
    cookie: sessionCookie
  });

export { getSession, commitSession, destroySession };
```

### Session API

After retrieving a session with `getSession`, the session object returned has a handful of methods and properties:

```js
export async function action({ request }) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  session.get("foo");
  session.has("bar");
  // etc.
}
```

#### `session.has(key)`

Returns `true` if the session has a variable with the given `name`.

```js
session.has("userId");
```

#### `session.set(key, value)`

Sets a session value for use in subsequent requests:

```js
session.set("userId", "1234");
```

#### `session.flash(key, value)`

Sets a session value that will be unset the first time it is read. After that, it's gone. Most useful for "flash messages" and server-side form validation messages:

```js
import { getSession, commitSession } from "../sessions";

export async function action({ request, params }) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  const deletedProject = await archiveProject(
    params.projectId
  );

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

```js
import React from "react";
import { Meta, Links, Scripts, Outlet, json } from "remix";

import { getSession, commitSession } from "./sessions";

export async function loader({ request }) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  const message = session.get("globalMessage") || null;

  return json(
    { message },
    {
      headers: {
        // only necessary with cookieSesionStorage
        "Set-Cookie": await commitSession(session)
      }
    }
  );
}

export default function App() {
  const { message } = useLoaderData();

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

#### `session.get()`

Accesses a session value from a previous request:

```js
session.get("name");
```

#### `session.unset()`

Removes a value from the session.

```js
session.unset("name");
```

<docs-info>When using cookieSessionStorage, you must commit the session whenever you `unset`</docs-info>

```js
return json(data, {
  headers: {
    "Set-Cookie": await commitSession(session)
  }
});
```

## Types

```ts
import type {
  ActionFunction,
  LoaderFunction,
  MetaFunction,
  LinksFunction,
  ShouldReloadFunction
} from "remix";
```

[meta-links-scripts]: #meta-links-scripts
[form]: #form
[cookies]: #cookies
[sessions]: #sessions
[usefetcher]: #usefetcher
[usetransition]: #usetransition
[useactiondata]: #useactiondata
[useloaderdata]: #useloaderdata
[usesubmit]: #usesubmit
[constraints]: ../other-api/constraints
[action]: ../app/#action
[loader]: ../app/#loader
[disabling-javascript]: ../guides/disabling-javascript
