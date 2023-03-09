---
title: useTransition
---

# `useTransition`

<docs-error>This API will be removed in v2 in favor of [`useNavigation`][use-navigation]. You can start using the new `useNavigation` hook today to make upgrading in the future easy, but you can keep using `useTransition` until v2.</docs-error>

---

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

## `transition.state`

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

## `transition.type`

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

### Moving away from `transition.type`

The `type` field has been removed in the new `useNavigation` hook (which will replace `useTransition` in Remix v2). We've found that `state` is sufficient for almost all use-cases, and when it's not you can derive sub-types via `navigation.state` and other fields. Also note that the `loaderSubmission` type is now represented with `state: "loading"`. Here's a few examples:

```js
function Component() {
  let navigation = useNavigation();

  let isActionSubmission =
    navigation.state === "submitting";

  let isActionReload =
    navigation.state === "loading" &&
    navigation.formMethod != null &&
    navigation.formMethod != "get" &&
    // We had a submission navigation and are loading the submitted location
    navigation.formAction === navigation.pathname;

  let isActionRedirect =
    navigation.state === "loading" &&
    navigation.formMethod != null &&
    navigation.formMethod != "get" &&
    // We had a submission navigation and are now navigating to different location
    navigation.formAction !== navigation.pathname;

  let isLoaderSubmission =
    navigation.state === "loading" &&
    navigation.state.formMethod === "get" &&
    // We had a loader submission and are navigating to the submitted location
    navigation.formAction === navigation.pathname;

  let isLoaderSubmissionRedirect =
    navigation.state === "loading" &&
    navigation.state.formMethod === "get" &&
    // We had a loader submission and are navigating to a new location
    navigation.formAction !== navigation.pathname;
}
```

## `transition.submission`

Any transition that started from a `<Form>` or `useSubmit` will have your form's submission attached to it. This is primarily useful to build "Optimistic UI" with the `submission.formData` [`FormData`][form-data] object.

### Moving away from `transition.submission`

The `submission` field has been removed in the new `useNavigation` hook (which will replace `useTransition` in Remix v2) and the same sub-fields are now exposed directly on the `navigation`:

```js
function Component() {
  let navigation = useNavigation();
  // navigation.formMethod
  // navigation.formAction
  // navigation.formData
  // navigation.formEncType
}
```

## `transition.location`

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

[usefetcher]: ./use-fetcher
[form-data]: https://developer.mozilla.org/en-US/docs/Web/API/FormData
[use-navigation]: ./use-navigation
