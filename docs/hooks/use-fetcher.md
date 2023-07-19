---
title: useFetcher
---

# `useFetcher`

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
- [`useNavigation`][usenavigation]

If you're building a highly interactive, "app-like" user interface, you will use `useFetcher` often.

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
  fetcher.formMethod;
  fetcher.formAction;
  fetcher.formData;
  fetcher.formEncType;
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

## `fetcher.state`

You can know the state of the fetcher with `fetcher.state`. It will be one of:

- **idle** - Nothing is being fetched.
- **submitting** - A form has been submitted. If the method is GET, then the route loader is being called. If POST, PUT, PATCH, or DELETE, then the route action is being called.
- **loading** - The loaders for the routes are being reloaded after an action submission.

## `fetcher.type`

<docs-warning>`fetcher.type` will be removed in v2. For instructions on preparing for this change see the [v2 guide][v2guide].</docs-warning>

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

## `fetcher.submission`

<docs-warning>`fetcher.submission` will be flattened into the fetcher object itself in v2. For instructions on preparing for this change see the [v2 guide][v2guide].</docs-warning>

When using `<fetcher.Form>` or `fetcher.submit()`, the form submission is available to build optimistic UI.

It is not available when the fetcher state is "idle" or "loading".

## `fetcher.data`

The returned response data from your loader or action is stored here. Once the data is set, it persists on the fetcher even through reloads and resubmissions (like calling `fetcher.load()` again after having already read the data).

## `fetcher.Form`

Just like `<Form>` except it doesn't cause a navigation.

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

## `fetcher.submit()`

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

```tsx
fetcher.submit(
  { some: "values" },
  { method: "post", action: "/accounts?index" }
);
```

See also:

- [`?index` query param][index query param]

## `fetcher.load()`

Loads data from a route loader.

```tsx
function SomeComponent() {
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data == null) {
      fetcher.load("/some/route");
    }
  }, [fetcher]);

  fetcher.data; // the data from the loader
}
```

Although a URL matches multiple Routes in a remix router hierarchy, a `fetcher.load()` call will only call the loader on the deepest matching route, unless the deepest matching route is an "index route". In this case, it will load the parent route of the index route (because they share the same URL).

If you want to load an index route use `?index` in the URL:

```ts
fetcher.load("/some/route?index");
```

See also:

- [`?index` query param][index query param]

## Examples

<docs-success>Watch the <a href="https://www.youtube.com/playlist?list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">📼 Remix Single</a>: <a href="https://www.youtube.com/watch?v=jd_bin5HPrw&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6">Remix Newsletter Signup Form</a></docs-success>

**Newsletter Signup Form**

Perhaps you have a persistent newsletter signup at the bottom of every page on your site. This is not a navigation event, so useFetcher is perfect for the job. First, you create a Resource Route:

```tsx filename=routes/newsletter/subscribe.tsx
export async function action({ request }: ActionArgs) {
  const email = (await request.formData()).get("email");
  try {
    await subscribe(email);
    return json({ error: null, ok: true });
  } catch (error) {
    return json({ error: error.message, ok: false });
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
    if (
      newsletter.state === "idle" &&
      newsletter.data?.ok
    ) {
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

      {newsletter.state === "idle" && newsletter.data ? (
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

Because `useFetcher` doesn't cause a navigation, it won't automatically work if there is no JavaScript on the page like a normal Remix `<Form>` will, because the browser will still navigate to the form's action.

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

- When JS is on the page, the user will subscribe to the newsletter and the page won't change, they'll just get a solid, dynamic experience.
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
    />
  );
}

// used here and in the route
export function NewsletterForm({ Form, data, state }) {
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
    <NewsletterForm Form={Form} data={data} state="idle" />
  );
}
```

**Mark Article as Read**

Imagine you want to mark that an article has been read by the current user, after they've been on the page for a while and scrolled to the bottom. You could make a hook that looks something like this:

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
  const userDetails = useFetcher<typeof loader>();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (
      showDetails &&
      userDetails.state === "idle" &&
      !userDetails.data
    ) {
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
        userDetails.state === "idle" && userDetails.data ? (
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
  const cities = useFetcher<typeof loader>();

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

[form]: ../components/form
[index query param]: ../guides/routing#what-is-the-index-query-param
[usenavigation]: ./use-navigation
[useactiondata]: ./use-action-data
[useloaderdata]: ./use-loader-data
[v2guide]: ../pages/v2#usefetcher
