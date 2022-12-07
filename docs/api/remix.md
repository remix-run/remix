---
title: Remix Packages
order: 2
---

# Remix Packages

React: `@remix-run/react`

Server runtimes:

- `@remix-run/cloudflare`
- `@remix-run/deno`
- `@remix-run/node`

Server adapters:

- `@remix-run/architect`
- `@remix-run/cloudflare-pages`
- `@remix-run/cloudflare-workers`
- `@remix-run/express`
- `@remix-run/netlify`
- `@remix-run/vercel`

These package provides all the components, hooks, and [Web Fetch API][web-fetch-api] objects and helpers.

## Components and Hooks

### `<Links>`, `<LiveReload>`, `<Meta>`, `<Scripts>`, `<ScrollRestoration>`

These components are to be used once inside your root route (`root.tsx`). They include everything Remix figured out or built in order for your page to render properly.

```tsx
import type {
  LinksFunction,
  MetaFunction,
} from "@remix-run/node"; // or cloudflare/deno
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
        {/* If you use a nonce-based content security policy for scripts, you must provide the `nonce` prop. Otherwise, omit the nonce prop as shown here. */}
        <ScrollRestoration />

        {/* Script tags go here */}
        {/* If you use a nonce-based content security policy for scripts, you must provide the `nonce` prop. Otherwise, omit the nonce prop as shown here. */}
        <Scripts />

        {/* Sets up automatic reload when you change code */}
        {/* and only does anything during development */}
        {/* If you use a nonce-based content security policy for scripts, you must provide the `nonce` prop. Otherwise, omit the nonce prop as shown here. */}
        <LiveReload />
      </body>
    </html>
  );
}
```

You can pass extra props to `<Scripts />` like `<Scripts crossOrigin />` for hosting your static assets on a different server than your app.

The example above renders several `<script />` tags into the resulting HTML. While this usually just works, you might have configured a [content security policy for scripts][content-security-policy-for-scripts] that prevents these `<script />` tags from being executed. In particular, to support [content security policies with nonce-sources for scripts][content-security-policies-with-nonce-sources-for-scripts], the `<Scripts />`, `<LiveReload />` and `<ScrollRestoration />` components support a `nonce` property, e.g.`<Script nonce={nonce}/>`. The provided nonce is subsequently passed to the `<script />` tag rendered into the HTML by these components, allowing the scripts to be executed in accordance with your CSP policy.

Learn more about `meta` and `links` exports in the [conventions][conventions] documentation.

### `<Link>`

This component renders an anchor tag and is the primary way the user will navigate around your website. Anywhere you would have used `<a href="...">` you should now use `<Link to="..."/>` to get all the performance benefits of client-side routing in Remix.

It wraps React Router's Link with some extra behavior around resource prefetching.

```tsx
import { Link } from "@remix-run/react";

export default function GlobalNav() {
  return (
    <nav>
      <Link to="/dashboard">Dashboard</Link>{" "}
      <Link to="/account">Account</Link>{" "}
      <Link to="/support">Support</Link>
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
- **"intent"** - Recommended if you want to prefetch. Fetches when Remix thinks the user intends to visit the link. Right now the behavior is simple: if they hover or focus the link it will prefetch the resources. In the future we hope to make this even smarter. Links with large click areas/padding get a bit of a head start. It is worth noting that when using `prefetch="intent"`, `<link rel="prefetch">` elements will be inserted on hover/focus and removed if the `<Link>` loses hover/focus. Without proper `cache-control` headers on your loaders this could result in repeated prefetch loads if a user continually hovers on and off a link.
- **"render"** - Fetches when the link is rendered.

<docs-error>You may need to use the <code>:last-of-type</code> selector instead of <code>:last-child</code> when styling child elements inside of your links</docs-error>

Remix uses the browser's cache for prefetching with HTML `<link rel="prefetch"/>` tags, which provides a lot of subtle benefits (like respecting HTTP cache headers, doing the work in browser idle time, using a different thread than your app, etc.) but the implementation might mess with your CSS since the link tags are rendered inside of your anchor tag. This means `a *:last-child {}` style selectors won't work. You'll need to change them to `a *:last-of-type {}` and you should be good. We will eventually get rid of this limitation.

### `<PrefetchPageLinks />`

This component renders all of the `<link rel="prefetch">` and `<link rel="modulepreload"/>` tags for all the assets (data, modules, css) of a given page.

This is the component `<Link rel="prefetch">` uses internally, but you render this component to prefetch a page for any other reason.

```tsx
<PrefetchPageLinks page="/absolute/path/to/your-path" />
```

**Note:** You need to use an absolute path.

### `<NavLink>`

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

### `<Form>`

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

#### `<Form action>`

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

See also:

- [`?index` query param][index query param]

#### `<Form method>`

This determines the [HTTP verb][http-verb] to be used: get, post, put, patch, delete. The default is "get".

```tsx
<Form method="post" />
```

Native `<form>` only supports get and post, so if you want your form to work with JavaScript on or off the page you'll need to stick with those two.

Without JavaScript, Remix will turn non-get requests into "post", but you'll still need to instruct your server with a hidden input like `<input type="hidden" name="_method" value="delete" />`. If you always include JavaScript, you don't need to worry about this.

<docs-info>We generally recommend sticking with "get" and "post" because the other verbs are not supported by HTML</docs-info>

#### `<Form encType>`

Defaults to `application/x-www-form-urlencoded`, use `multipart/form-data` for file uploads.

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

<docs-info>This is recommended over <code>\<form></code></docs-info>

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

### `useLoaderData`

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Single</a>: <a href="https://www.youtube.com/watch?v=NXqEP_PsPNc&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Loading data into components</a></docs-success>

This hook returns the JSON parsed data from your route loader function.

```tsx lines=[2,9]
import { json } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";

export async function loader() {
  return json(await fakeDb.invoices.findAll());
}

export default function Invoices() {
  const invoices = useLoaderData<typeof loader>();
  // ...
}
```

### `useActionData`

This hook returns the JSON parsed data from your route action. It returns `undefined` if there hasn't been a submission at the current location yet.

```tsx lines=[3,12,21]
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import { useActionData, Form } from "@remix-run/react";

export async function action({ request }: ActionArgs) {
  const body = await request.formData();
  const name = body.get("visitorsName");
  return json({ message: `Hello, ${name}` });
}

export default function Invoices() {
  const data = useActionData<typeof action>();
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

```tsx lines=[23,32,40-42,46-48]
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { redirect, json } from "@remix-run/node"; // or cloudflare/deno
import { Form, useActionData } from "@remix-run/react";

export async function action({ request }: ActionArgs) {
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
  const errors = useActionData<typeof action>();

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

### `useFormAction`

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

### `useSubmit`

Returns the function that may be used to submit a `<form>` (or some raw `FormData`) to the server using the same process that `<Form>` uses internally `onSubmit`. If you're familiar with React Router's `useNavigate`, you can think about this as the same thing but for `<Form>` instead of `<Link>`.

This is useful whenever you need to programmatically submit a form. For example, you may wish to save a user preferences form whenever any field changes.

```tsx filename=app/routes/prefs.tsx lines=[3,15,19]
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import { useSubmit, useTransition } from "@remix-run/react";

export async function loader() {
  return json(await getUserPreferences());
}

export async function action({ request }: ActionArgs) {
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

### `useTransition`

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

#### `transition.state`

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
  - **normalRedirect** - A loader from a normal navigation (or redirect) redirected to a new location and the new routes are being loaded
  - **normalLoad** - A normal load from a normal navigation

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

#### `transition.submission`

Any transition that started from a `<Form>` or `useSubmit` will have your form's submission attached to it. This is primarily useful to build "Optimistic UI" with the `submission.formData` [`FormData`][form-data] object.

TODO: Example

#### `transition.location`

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

### `useFetcher`

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

If you're building a highly interactive, "app like" user interface, you will use `useFetcher` often.

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

#### `fetcher.state`

You can know the state of the fetcher with `fetcher.state`. It will be one of:

- **idle** - nothing is being fetched.
- **submitting** - A form has been submitted. If the method is GET, then the route loader is being called. If POST, PUT, PATCH, or DELETE, then the route action is being called.
- **loading** - The loaders for the routes are being reloaded after an action submission

#### `fetcher.type`

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
  - **normalLoad** - A route's loader is being called without a submission (`fetcher.load()`).

#### `fetcher.submission`

When using `<fetcher.Form>` or `fetcher.submit()`, the form submission is available to build optimistic UI.

It is not available when the fetcher state is "idle" or "loading".

#### `fetcher.data`

The returned response data from your loader or action is stored here. Once the data is set, it persists on the fetcher even through reloads and resubmissions (like calling `fetcher.load()` again after having already read the data).

#### `fetcher.Form`

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

#### `fetcher.submit()`

Just like `useSubmit` except it doesn't cause a navigation.

```tsx
function SomeComponent() {
  const fetcher = useFetcher();

  const onClick = () =>
    fetcher.submit({ some: "values" }, { method: "post" });

  // ...
}
```

Although a URL matches multiple Routes in a remix router hierarchy, a `fetcher.submit()` call will only call the action on the deepest matching route, unless the deepest matching route is an "index route". In this case, it will post to the parent route of the index route (because they share the same URL).

If you want to submit to an index route use `?index` in the URL:

```js
fetcher.submit(
  { some: "values" },
  { method: "post", action: "/accounts?index" }
);
```

See also:

- [`?index` query param][index query param]

#### `fetcher.load()`

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

Although a URL matches multiple Routes in a remix router hierarchy, a `fetcher.load()` call will only call the loader on the deepest matching route, unless the deepest matching route is an "index route". In this case, it will load the parent route of the index route (because they share the same URL).

If you want to load an index route use `?index` in the URL:

```js
fetcher.load("/some/route?index");
```

See also:

- [`?index` query param][index query param]

#### Examples

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Single</a>: <a href="https://www.youtube.com/watch?v=jd_bin5HPrw&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Remix Newsletter Signup Form</a></docs-success>

**Newsletter Signup Form**

Perhaps you have a persistent newsletter signup at the bottom of every page on your site. This is not a navigation event, so useFetcher is perfect for the job. First, you create a Resource Route:

```tsx filename=routes/newsletter/subscribe.tsx
export async function action({ request }: ActionArgs) {
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
export async function action({ request }: ActionArgs) {
  // just like before
}

export default function NewsletterSignupRoute() {
  const newsletter = useActionData<typeof action>();
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
  const data = useActionData<typeof action>();
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
export async function loader({ params }: LoaderArgs) {
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
export async function loader({ request }: LoaderArgs) {
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

### `useFetchers`

Returns an array of all inflight fetchers.

This is useful for components throughout the app that didn't create the fetchers but want to use their submissions to participate in optimistic UI.

For example, imagine a UI where the sidebar lists projects, and the main view displays a list of checkboxes for the current project. The sidebar could display the number of completed and total tasks for each project.

```
+-----------------+----------------------------+
|                 |                            |
|   Soccer  (8/9) | [x] Do the dishes          |
|                 |                            |
| > Home    (2/4) | [x] Fold laundry           |
|                 |                            |
|                 | [ ] Replace battery in the |
|                 |     smoke alarm            |
|                 |                            |
|                 | [ ] Change lights in kids  |
|                 |     bathroom               |
|                 |                            |
+-----------------+----------------------------┘
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

This is awesome for the checkbox, but the sidebar will say 2/4 while the checkboxes show 3/4 when the user clicks one of them!

```
+-----------------+----------------------------+
|                 |                            |
|   Soccer  (8/9) | [x] Do the dishes          |
|                 |                            |
| > Home    (2/4) | [x] Fold laundry           |
|                 |                            |
|          CLICK!-->[x] Replace battery in the |
|                 |     smoke alarm            |
|                 |                            |
|                 | [ ] Change lights in kids  |
|                 |     bathroom               |
|                 |                            |
+-----------------+----------------------------┘
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

### `useMatches`

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

For an example of how to share loader data via `useMatches`, check out [the sharing loader data example in the remix repo][example-sharing-loader-data].

### `useBeforeUnload`

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

## HTTP Helpers

### `json`

This is a shortcut for creating `application/json` responses. It assumes you are using `utf-8` encoding.

```ts lines=[1,5]
import { json } from "@remix-run/node"; // or cloudflare/deno

export const loader = async () => {
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

```ts lines=[4-9]
export const loader = async () => {
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

### `redirect`

This is shortcut for sending 30x responses.

```ts lines=[1,7]
import { redirect } from "@remix-run/node"; // or cloudflare/deno

export const action = async () => {
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
return new Response(null, {
  status: 303,
  headers: {
    Location: "/else/where",
  },
});
```

### `unstable_parseMultipartFormData`

Allows you to handle multipart forms (file uploads) for your app.

Would be useful to understand [the Browser File API][the-browser-file-api] to know how to use this API.

It's to be used in place of `request.formData()`.

```diff
- const formData = await request.formData();
+ const formData = await unstable_parseMultipartFormData(request, uploadHandler);
```

For example:

```tsx lines=[4-7,9,25]
export const action = async ({ request }: ActionArgs) => {
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler // <-- we'll look at this deeper next
  );

  // the returned value for the file field is whatever our uploadHandler returns.
  // Let's imagine we're uploading the avatar to s3,
  // so our uploadHandler returns the URL.
  const avatarUrl = formData.get("avatar");

  // update the currently logged in user's avatar in our database
  await updateUserAvatar(request, avatarUrl);

  // success! Redirect to account page
  return redirect("/account");
};

export default function AvatarUploadRoute() {
  return (
    <Form method="post" encType="multipart/form-data">
      <label htmlFor="avatar-input">Avatar</label>
      <input id="avatar-input" type="file" name="avatar" />
      <button>Upload</button>
    </Form>
  );
}
```

### `uploadHandler`

The `uploadHandler` is the key to the whole thing. It's responsible for what happens to the multipart/form-data parts as they are being streamed from the client. You can save it to disk, store it in memory, or act as a proxy to send it somewhere else (like a file storage provider).

Remix has two utilities to create `uploadHandler`s for you:

- `unstable_createFileUploadHandler`
- `unstable_createMemoryUploadHandler`

These are fully featured utilities for handling fairly simple use cases. It's not recommended to load anything but quite small files into memory. Saving files to disk is a reasonable solution for many use cases. But if you want to upload the file to a file hosting provider, then you'll need to write your own.

#### `unstable_createFileUploadHandler (node)`

An upload handler that will write parts with a filename to disk to keep them out of memory, parts without a filename will not be parsed. Should be composed with another upload handler.

**Example:**

```tsx
export const action = async ({ request }: ActionArgs) => {
  const uploadHandler = unstable_composeUploadHandlers(
    unstable_createFileUploadHandler({
      maxPartSize: 5_000_000,
      file: ({ filename }) => filename,
    }),
    // parse everything else into memory
    unstable_createMemoryUploadHandler()
  );
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );

  const file = formData.get("avatar");

  // file is a "NodeOnDiskFile" which implements the "File" API
  // ... etc
};
```

**Options:**

| Property           | Type               | Default                         | Description                                                                                                                                                     |
| ------------------ | ------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| avoidFileConflicts | boolean            | true                            | Avoid file conflicts by appending a timestamp on the end of the filename if it already exists on disk                                                           |
| directory          | string \| Function | os.tmpdir()                     | The directory to write the upload.                                                                                                                              |
| file               | Function           | () => `upload_${random}.${ext}` | The name of the file in the directory. Can be a relative path, the directory structure will be created if it does not exist.                                    |
| maxPartSize        | number             | 3000000                         | The maximum upload size allowed (in bytes). If the size is exceeded a MaxPartSizeExceededError will be thrown.                                                  |
| filter             | Function           | OPTIONAL                        | A function you can write to prevent a file upload from being saved based on filename, content type, or field name. Return `false` and the file will be ignored. |

The function API for `file` and `directory` are the same. They accept an `object` and return a `string`. The object it accepts has `filename`, `name`, and `contentType` (all strings). The `string` returned is the path.

The `filter` function accepts an `object` and returns a `boolean` (or a promise that resolves to a `boolean`). The object it accepts has the `filename`, `name`, and `contentType` (all strings). The `boolean` returned is `true` if you want to handle that file stream.

#### `unstable_createMemoryUploadHandler`

**Example:**

```tsx
export const action = async ({ request }: ActionArgs) => {
  const uploadHandler = unstable_createMemoryUploadHandler({
    maxPartSize: 500_000,
  });
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );

  const file = formData.get("avatar");

  // file is a "File" (https://mdn.io/File) polyfilled for node
  // ... etc
};
```

**Options:** The only options supported are `maxPartSize` and `filter` which work the same as in `unstable_createFileUploadHandler` above. This API is not recommended for anything at scale, but is a convenient utility for simple use cases and as a fallback for another handler.

### Custom `uploadHandler`

Most of the time, you'll probably want to proxy the file to a file host.

**Example:**

```tsx
import type {
  ActionArgs,
  UploadHandler,
} from "@remix-run/node"; // or cloudflare/deno
import {
  unstable_composeUploadHandlers,
  unstable_createMemoryUploadHandler,
} from "@remix-run/node"; // or cloudflare/deno
// writeAsyncIterableToWritable is a Node-only utility
import { writeAsyncIterableToWritable } from "@remix-run/node";
import type {
  UploadApiOptions,
  UploadApiResponse,
  UploadStream,
} from "cloudinary";
import cloudinary from "cloudinary";

async function uploadImageToCloudinary(
  data: AsyncIterable<Uint8Array>
) {
  const uploadPromise = new Promise<UploadApiResponse>(
    async (resolve, reject) => {
      const uploadStream =
        cloudinary.v2.uploader.upload_stream(
          {
            folder: "remix",
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(result);
          }
        );
      await writeAsyncIterableToWritable(
        data,
        uploadStream
      );
    }
  );

  return uploadPromise;
}

export const action = async ({ request }: ActionArgs) => {
  const userId = getUserId(request);

  const uploadHandler = unstable_composeUploadHandlers(
    // our custom upload handler
    async ({ name, contentType, data, filename }) => {
      if (name !== "img") {
        return undefined;
      }
      const uploadedImage = await uploadImageToCloudinary(
        data
      );
      return uploadedImage.secure_url;
    },
    // fallback to memory for everything else
    unstable_createMemoryUploadHandler()
  );

  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );

  const imageUrl = formData.get("avatar");

  // because our uploadHandler returns a string, that's what the imageUrl will be.
  // ... etc
};
```

The `UploadHandler` function accepts a number of parameters about the file:

| Property    | Type                      | Description                                                                  |
| ----------- | ------------------------- | ---------------------------------------------------------------------------- |
| name        | string                    | The field name (comes from your HTML form field "name" value)                |
| data        | AsyncIterable<Uint8Array> | The iterable of the file bytes                                               |
| filename    | string                    | The name of the file that the user selected for upload (like `rickroll.mp4`) |
| contentType | string                    | The content type of the file (like `videomp4`)                               |

Your job is to do whatever you need with the `data` and return a value that's a valid [`FormData`][form-data] value: [`File`][the-browser-file-api], `string`, or `undefined` to skip adding it to the resulting FormData.

### Upload Handler Composition

We have the built-in `unstable_createFileUploadHandler` and `unstable_createMemoryUploadHandler` and we also expect more upload handler utilities to be developed in the future. If you have a form that needs to use different upload handlers, you can compose them together with a custom handler, here's a theoretical example:

```tsx filename=file-upload-handler.server.tsx
import type { UploadHandler } from "@remix-run/node"; // or cloudflare/deno
import { unstable_createFileUploadHandler } from "@remix-run/node"; // or cloudflare/deno
import { createCloudinaryUploadHandler } from "some-handy-remix-util";

export const standardFileUploadHandler =
  unstable_createFileUploadHandler({
    directory: "public/calendar-events",
  });

export const cloudinaryUploadHandler =
  createCloudinaryUploadHandler({
    folder: "/my-site/avatars",
  });

export const fileUploadHandler: UploadHandler = (args) => {
  if (args.name === "calendarEvent") {
    return standardFileUploadHandler(args);
  } else if (args.name === "eventBanner") {
    return cloudinaryUploadHandler(args);
  }
  return undefined;
};
```

## Cookies

A [cookie][cookie] is a small piece of information that your server sends someone in a HTTP response that their browser will send back on subsequent requests. This technique is a fundamental building block of many interactive websites that adds state so you can build authentication (see [sessions][sessions]), shopping carts, user preferences, and many other features that require remembering who is "logged in".

Remix's `Cookie` interface provides a logical, reusable container for cookie metadata.

### Using cookies

While you may create these cookies manually, it is more common to use a [session storage][sessions].

In Remix, you will typically work with cookies in your `loader` and/or `action` functions (see <Link to="../mutations">mutations</Link>), since those are the places where you need to read and write data.

Let's say you have a banner on your e-commerce site that prompts users to check out the items you currently have on sale. The banner spans the top of your homepage, and includes a button on the side that allows the user to dismiss the banner so they don't see it for at least another week.

First, create a cookie:

```js filename=app/cookies.js
import { createCookie } from "@remix-run/node"; // or cloudflare/deno

export const userPrefs = createCookie("user-prefs", {
  maxAge: 604_800, // one week
});
```

Then, you can `import` the cookie and use it in your `loader` and/or `action`. The `loader` in this case just checks the value of the user preference so you can use it in your component for deciding whether to render the banner. When the button is clicked, the `<form>` calls the `action` on the server and reloads the page without the banner.

**Note:** We recommend (for now) that you create all the cookies your app needs in `app/cookies.js` and `import` them into your route modules. This allows the Remix compiler to correctly prune these imports out of the browser build where they are not needed. We hope to eventually remove this caveat.

```tsx filename=app/routes/index.tsx lines=[8,12-13,19-10,24]
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node"; // or cloudflare/deno
import { json, redirect } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";

import { userPrefs } from "~/cookies";

export const loader = async ({ params }: LoaderArgs) => {
  const cookieHeader = request.headers.get("Cookie");
  const cookie =
    (await userPrefs.parse(cookieHeader)) || {};
  return json({ showBanner: cookie.showBanner });
};

export const action = async ({ request }: ActionArgs) => {
  const cookieHeader = request.headers.get("Cookie");
  const cookie =
    (await userPrefs.parse(cookieHeader)) || {};
  const bodyParams = await request.formData();

  if (bodyParams.get("bannerVisibility") === "hidden") {
    cookie.showBanner = false;
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": await userPrefs.serialize(cookie),
    },
  });
};

export default function Home() {
  const { showBanner } = useLoaderData<typeof loader>();

  return (
    <div>
      {showBanner ? (
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
      ) : null}
      <h1>Welcome!</h1>
    </div>
  );
}
```

### Cookie attributes

Cookies have [several attributes][several-attributes] that control when they expire, how they are accessed, and where they are sent. Any of these attributes may be specified either in `createCookie(name, options)`, or during `serialize()` when the `Set-Cookie` header is generated.

```js
const cookie = createCookie("user-prefs", {
  // These are defaults for this cookie.
  domain: "remix.run",
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: true,
  expires: new Date(Date.now() + 60_000),
  maxAge: 60,
});

// You can either use the defaults:
cookie.serialize(userPrefs);

// Or override individual ones as needed:
cookie.serialize(userPrefs, { sameSite: "strict" });
```

Please read [more info about these attributes][several-attributes] to get a better understanding of what they do.

### Signing cookies

It is possible to sign a cookie to automatically verify its contents when it is received. Since it's relatively easy to spoof HTTP headers, this is a good idea for any information that you do not want someone to be able to fake, like authentication information (see [sessions][sessions]).

To sign a cookie, provide one or more `secrets` when you first create the cookie:

```js
const cookie = createCookie("user-prefs", {
  secrets: ["s3cret1"],
});
```

Cookies that have one or more `secrets` will be stored and verified in a way that ensures the cookie's integrity.

Secrets may be rotated by adding new secrets to the front of the `secrets` array. Cookies that have been signed with old secrets will still be decoded successfully in `cookie.parse()`, and the newest secret (the first one in the array) will always be used to sign outgoing cookies created in `cookie.serialize()`.

```ts filename=app/cookies.ts
export const cookie = createCookie("user-prefs", {
  secrets: ["n3wsecr3t", "olds3cret"],
});
```

```ts filename=app/routes/route.tsx
import { cookie } from "~/cookies";

export async function loader({ request }: LoaderArgs) {
  const oldCookie = request.headers.get("Cookie");
  // oldCookie may have been signed with "olds3cret", but still parses ok
  const value = await cookie.parse(oldCookie);

  new Response("...", {
    headers: {
      // Set-Cookie is signed with "n3wsecr3t"
      "Set-Cookie": await cookie.serialize(value),
    },
  });
}
```

### `createCookie`

Creates a logical container for managing a browser cookie from the server.

```ts
import { createCookie } from "@remix-run/node"; // or cloudflare/deno

const cookie = createCookie("cookie-name", {
  // all of these are optional defaults that can be overridden at runtime
  domain: "remix.run",
  expires: new Date(Date.now() + 60_000),
  httpOnly: true,
  maxAge: 60,
  path: "/",
  sameSite: "lax",
  secrets: ["s3cret1"],
  secure: true,
});
```

To learn more about each attribute, please see the [MDN Set-Cookie docs][several-attributes].

### `isCookie`

Returns `true` if an object is a Remix cookie container.

```ts
import { isCookie } from "@remix-run/node"; // or cloudflare/deno
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
      showBanner: true,
    }),
  },
});
```

#### `cookie.isSigned`

Will be `true` if the cookie uses any `secrets`, `false` otherwise.

```js
let cookie = createCookie("user-prefs");
console.log(cookie.isSigned); // false

cookie = createCookie("user-prefs", {
  secrets: ["soopersekrit"],
});
console.log(cookie.isSigned); // true
```

#### `cookie.expires`

The `Date` on which this cookie expires. Note that if a cookie has both `maxAge` and `expires`, this value will be the date at the current time plus the `maxAge` value since `Max-Age` takes precedence over `Expires`.

```js
const cookie = createCookie("user-prefs", {
  expires: new Date("2021-01-01"),
});

console.log(cookie.expires); // "2020-01-01T00:00:00.000Z"
```

## Sessions

Sessions are an important part of websites that allow the server to identify requests coming from the same person, especially when it comes to server-side form validation or when JavaScript is not on the page. Sessions are a fundamental building block of many sites that let users "log in", including social, e-commerce, business, and educational websites.

In Remix, sessions are managed on a per-route basis (rather than something like express middleware) in your `loader` and `action` methods using a "session storage" object (that implements the `SessionStorage` interface). Session storage understands how to parse and generate cookies, and how to store session data in a database or filesystem.

Remix comes with several pre-built session storage options for common scenarios, and one to create your own:

- `createCookieSessionStorage`
- `createMemorySessionStorage`
- `createFileSessionStorage` (node)
- `createCloudflareKVSessionStorage` (cloudflare-workers)
- `createArcTableSessionStorage` (architect, Amazon DynamoDB)
- custom storage with `createSessionStorage`

### Using Sessions

This is an example of a cookie session storage:

```js filename=app/sessions.js
// app/sessions.js
import { createCookieSessionStorage } from "@remix-run/node"; // or cloudflare/deno

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage({
    // a Cookie from `createCookie` or the CookieOptions to create one
    cookie: {
      name: "__session",

      // all of these are optional
      domain: "remix.run",
      // Expires can also be set (although maxAge overrides it when used in combination).
      // Note that this method is NOT recommended as `new Date` creates only one date on each server deployment, not a dynamic date in the future!
      //
      // expires: new Date(Date.now() + 60_000),
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

We recommend setting up your session storage object in `app/sessions.js` so all routes that need to access session data can import from the same spot (also, see our [Route Module Constraints][constraints]).

The input/output to a session storage object are HTTP cookies. `getSession()` retrieves the current session from the incoming request's `Cookie` header, and `commitSession()`/`destroySession()` provide the `Set-Cookie` header for the outgoing response.

You'll use methods to get access to sessions in your `loader` and `action` functions.

A login form might look something like this:

```tsx filename=app/routes/login.js lines=[8,11-13,15,20,24,30-32,43,48,53,58]
import type {
  ActionArgs,
  LoaderArgs,
} from "@remix-run/node"; // or cloudflare/deno
import { json, redirect } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";

import { getSession, commitSession } from "../sessions";

export async function loader({ request }: LoaderArgs) {
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
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function action({ request }: ActionArgs) {
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
  const { currentUser, error } =
    useLoaderData<typeof loader>();

  return (
    <div>
      {error ? <div className="error">{error}</div> : null}
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

export const action = async ({ request }: ActionArgs) => {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  return redirect("/login", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
};

export default function LogoutRoute() {
  return (
    <>
      <p>Are you sure you want to log out?</p>
      <Form method="post">
        <button>Logout</button>
      </Form>
      <Link to="/">Never mind</Link>
    </>
  );
}
```

<docs-warning>It's important that you logout (or perform any mutation for that matter) in an `action` and not a `loader`. Otherwise you open your users to [Cross-Site Request Forgery][cross-site-request-forgery] attacks. Also, Remix only re-calls `loaders` when `actions` are called.</docs-warning>

### Session Gotchas

Because of nested routes, multiple loaders can be called to construct a single page. When using `session.flash()` or `session.unset()`, you need to be sure no other loaders in the request are going to want to read that, otherwise you'll get race conditions. Typically if you're using flash, you'll want to have a single loader read it, if another loader wants a flash message, use a different key for that loader.

### `createSession`

TODO:

### `isSession`

Returns `true` if an object is a Remix session.

```js
import { isSession } from "@remix-run/node"; // or cloudflare/deno

const sessionData = { foo: "bar" };
const session = createSession(sessionData, "remix-session");
console.log(isSession(session));
// true
```

### `createSessionStorage`

Remix makes it easy to store sessions in your own database if needed. The `createSessionStorage()` API requires a `cookie` (or options for creating a cookie, see [cookies][cookies]) and a set of create, read, update, and delete (CRUD) methods for managing the session data. The cookie is used to persist the session ID.

The following example shows how you could do this using a generic database client:

```js
import { createSessionStorage } from "@remix-run/node"; // or cloudflare/deno

function createDatabaseSessionStorage({
  cookie,
  host,
  port,
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
    },
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
      sameSite: "lax",
    },
  });
```

The `expires` argument to `createData` and `updateData` is the same `Date` at which the cookie itself expires and is no longer valid. You can use this information to automatically purge the session record from your database to save on space, or to ensure that you do not otherwise return any data for old, expired cookies.

### `createCookieSessionStorage`

For purely cookie-based sessions (where the session data itself is stored in the session cookie with the browser, see [cookies][cookies]) you can use `createCookieSessionStorage()`.

The main advantage of cookie session storage is that you don't need any additional backend services or databases to use it. It can also be beneficial in some load balanced scenarios. However, cookie-based sessions may not exceed the browser's max allowed cookie length (typically 4kb).

The downside is that you have to `commitSession` in almost every loader and action. If your loader or action changes the session at all, it must be committed. That means if you `session.flash` in an action, and then `session.get` in another, you must commit it for that flashed message to go away. With other session storage strategies you only have to commit it when it's created (the browser cookie doesn't need to change because it doesn't store the session data, just the key to find it elsewhere).

```js
import { createCookieSessionStorage } from "@remix-run/node"; // or cloudflare/deno

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage({
    // a Cookie from `createCookie` or the same CookieOptions to create one
    cookie: {
      name: "__session",
      secrets: ["r3m1xr0ck5"],
      sameSite: "lax",
    },
  });
```

### `createMemorySessionStorage`

This storage keeps all the cookie information in your server's memory.

<docs-error>This should only be used in development. Use one of the other methods in production.</docs-error>

```js
// app/sessions.js
import {
  createCookie,
  createMemorySessionStorage,
} from "@remix-run/node"; // or cloudflare/deno

// In this example the Cookie is created separately.
const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true,
});

const { getSession, commitSession, destroySession } =
  createMemorySessionStorage({
    cookie: sessionCookie,
  });

export { getSession, commitSession, destroySession };
```

### `createFileSessionStorage` (node)

For file-backed sessions, use `createFileSessionStorage()`. File session storage requires a file system, but this should be readily available on most cloud providers that run express, maybe with some extra configuration.

The advantage of file-backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a regular file on disk, ideal for sessions with more than 4kb of data.

<docs-info>If you are deploying to a serverless function, ensure you have access to a persistent file system. They usually don't have one without extra configuration.</docs-info>

```js filename=app/sesions.js
import {
  createCookie,
  createFileSessionStorage,
} from "@remix-run/node"; // or cloudflare/deno

// In this example the Cookie is created separately.
const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true,
});

const { getSession, commitSession, destroySession } =
  createFileSessionStorage({
    // The root directory where you want to store the files.
    // Make sure it's writable!
    dir: "/app/sessions",
    cookie: sessionCookie,
  });

export { getSession, commitSession, destroySession };
```

### `createCloudflareKVSessionStorage` (cloudflare-workers)

For [Cloudflare KV][cloudflare-kv] backed sessions, use `createCloudflareKVSessionStorage()`.

The advantage of KV backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a globally replicated, low-latency data store with exceptionally high read volumes with low-latency.

```js
// app/sessions.server.js
import {
  createCookie,
  createCloudflareKVSessionStorage,
} from "@remix-run/cloudflare";

// In this example the Cookie is created separately.
const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  sameSite: true,
});

const { getSession, commitSession, destroySession } =
  createCloudflareKVSessionStorage({
    // The KV Namespace where you want to store sessions
    kv: YOUR_NAMESPACE,
    cookie: sessionCookie,
  });

export { getSession, commitSession, destroySession };
```

### `createArcTableSessionStorage` (architect, Amazon DynamoDB)

For [Amazon DynamoDB][amazon-dynamo-db] backed sessions, use `createArcTableSessionStorage()`.

The advantage of DynamoDB backed sessions is that only the session ID is stored in the cookie while the rest of the data is stored in a globally replicated, low-latency data store with exceptionally high read volumes with low-latency.

```
# app.arc
sessions
  _idx *String
  _ttl TTL
```

```js
// app/sessions.server.js
import {
  createCookie,
  createArcTableSessionStorage,
} from "@remix-run/architect";

// In this example the Cookie is created separately.
const sessionCookie = createCookie("__session", {
  secrets: ["r3m1xr0ck5"],
  maxAge: 3600,
  sameSite: true,
});

const { getSession, commitSession, destroySession } =
  createArcTableSessionStorage({
    // The name of the table (should match app.arc)
    table: "sessions",
    // The name of the key used to store the session ID (should match app.arc)
    idx: "_idx",
    // The name of the key used to store the expiration time (should match app.arc)
    ttl: "_ttl",
    cookie: sessionCookie,
  });

export { getSession, commitSession, destroySession };
```

### Session API

After retrieving a session with `getSession`, the session object returned has a handful of methods and properties:

```tsx
export async function action({ request }: ActionArgs) {
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

```tsx
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno

import { getSession, commitSession } from "../sessions";

export async function action({
  params,
  request,
}: ActionArgs) {
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
      "Set-Cookie": await commitSession(session),
    },
  });
}
```

Now we can read the message in a loader.

<docs-info>You must commit the session whenever you read a `flash`. This is different than you might be used to where some type of middleware automatically sets the cookie header for you.</docs-info>

```tsx
import type { LoaderArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import {
  Meta,
  Links,
  Scripts,
  Outlet,
} from "@remix-run/react";

import { getSession, commitSession } from "./sessions";

export async function loader({ request }: LoaderArgs) {
  const session = await getSession(
    request.headers.get("Cookie")
  );
  const message = session.get("globalMessage") || null;

  return json(
    { message },
    {
      headers: {
        // only necessary with cookieSessionStorage
        "Set-Cookie": await commitSession(session),
      },
    }
  );
}

export default function App() {
  const { message } = useLoaderData<typeof loader>();

  return (
    <html>
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        {message ? (
          <div className="flash">{message}</div>
        ) : null}
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

```tsx
export async function loader({ request }: LoaderArgs) {
  // ...

  return json(data, {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}
```

### `<Outlet context />`

This component is a wrapper around React Router's Outlet with the ability to pass UI state down to nested routes.

<docs-warning>You can use this for loader data, but you don't need to. It's easier to access all loader data in any component via [`useLoaderData`][use-loader-data] or [`useMatches`][use-matches].</docs-warning>

Here's a practical example of when you may want to use this feature. Let's say you've got a list of companies that have invoices and you want to display those companies in an accordion. We'll render our outlet in that accordion, but we want the invoice sorting to be controlled by the parent (so changing companies preserves the invoice sorting). This is a perfect use case for `<Outlet context>`.

```tsx filename=app/routes/companies.tsx lines=[5,28-31,36-44,53-57,68]
import { json } from "@remix-run/node"; // or cloudflare/deno
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

import { getCompanies } from "~/utils/companies";

export const loader = async () => {
  return json({
    companies: await getCompanies(),
  });
};

type Sort = "ASC" | "DESC";
export type ContextType = {
  invoiceSort: Sort;
};

export default function CompaniesRoute() {
  const data = useLoaderData<typeof loader>();

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

### `useOutletContext()`

This hook returns the context from the `<Outlet />` that rendered you.

Continuing from the `<Outlet context />` example above, here's what the child route could do to use the sort order.

```tsx filename=app/routes/companies/$companyId.tsx lines=[5,8,25,27-30]
import type { LoaderArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import {
  useLoaderData,
  useOutletContext,
} from "@remix-run/react";

import type { ContextType } from "../companies";

export const loader = async ({ params }: LoaderArgs) => {
  return json({
    company: await getCompany(params.companyId),
  });
};

export default function CompanyRoute() {
  const data = useLoaderData<typeof loader>();
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

[meta-links-scripts]: #meta-links-scripts
[form]: #form
[cookies]: #cookies
[sessions]: #sessions
[usefetcher]: #usefetcher
[usetransition]: #usetransition
[useactiondata]: #useactiondata
[useloaderdata]: #useloaderdata
[usesubmit]: #usesubmit
[constraints]: ../guides/constraints
[action]: #form-action
[disabling-javascript]: ../guides/disabling-javascript
[example-sharing-loader-data]: https://github.com/remix-run/examples/tree/main/sharing-loader-data
[index query param]: ../guides/routing#what-is-the-index-query-param
[web-fetch-api]: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
[content-security-policy-for-scripts]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src
[content-security-policies-with-nonce-sources-for-scripts]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/Sources#sources
[conventions]: /api/conventions
[http-verb]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
[form-data]: https://developer.mozilla.org/en-US/docs/Web/API/FormData
[the-browser-file-api]: https://developer.mozilla.org/en-US/docs/Web/API/File
[cookie]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies
[several-attributes]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#attributes
[cross-site-request-forgery]: https://developer.mozilla.org/en-US/docs/Glossary/CSRF
[cloudflare-kv]: https://developers.cloudflare.com/workers/learning/how-kv-works
[amazon-dynamo-db]: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide
[use-loader-data]: #useloaderdata
[use-matches]: #usematches
