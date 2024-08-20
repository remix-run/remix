---
title: Form
---

# `<Form>`

A progressively enhanced HTML [`<form>`][form_element] that submits data to actions via `fetch`, activating pending states in `useNavigation` which enables advanced user interfaces beyond a basic HTML form. After a form's action completes, all data on the page is automatically revalidated from the server to keep the UI in sync with the data.

Because it uses the HTML form API, server rendered pages are interactive at a basic level before JavaScript loads. Instead of Remix managing the submission, the browser manages the submission as well as the pending states (like the spinning favicon). After JavaScript loads, Remix takes over enabling web application user experiences.

Form is most useful for submissions that should also change the URL or otherwise add an entry to the browser history stack. For forms that shouldn't manipulate the browser history stack, use [`<fetcher.Form>`][fetcher_form].

```tsx
import { Form } from "@remix-run/react";

function NewEvent() {
  return (
    <Form action="/events" method="post">
      <input name="title" type="text" />
      <input name="description" type="text" />
    </Form>
  );
}
```

## Props

### `action`

The URL to submit the form data to.

If `undefined`, this defaults to the closest route in context. If a parent route renders a `<Form>` but the URL matches deeper child routes, the form will post to the parent route. Likewise, a form inside the child route will post to the child route. This differs from a native [`<form>`][form_element] that will always point to the full URL.

<docs-info>Please see the [Splat Paths][relativesplatpath] section on the `useResolvedPath` docs for a note on the behavior of the `future.v3_relativeSplatPath` future flag for relative `<Form action>` behavior within splat routes</docs-info>

### `method`

This determines the [HTTP verb][http_verb] to be used: `DELETE`, `GET`, `PATCH`, `POST`, and `PUT`. The default is `GET`.

```tsx
<Form method="post" />
```

Native [`<form>`][form_element] only supports `GET` and `POST`, so you should avoid the other verbs if you'd like to support [progressive enhancement][progressive_enhancement]

### `encType`

The encoding type to use for the form submission.

```tsx
<Form encType="multipart/form-data" />
```

Defaults to `application/x-www-form-urlencoded`, use `multipart/form-data` for file uploads.

### `navigate`

You can tell the form to skip the navigation and use a [fetcher][use_fetcher] internally by specifying `<Form navigate={false}>`. This is essentially a shorthand for `useFetcher()` + `<fetcher.Form>` where you don't care about the resulting data and only want to kick off a submission and access the pending state via [`useFetchers()`][use_fetchers].

```tsx
<Form method="post" navigate={false} />
```

### `fetcherKey`

When using a non-navigating `Form`, you may also optionally specify your own fetcher `key` to use.

```tsx
<Form method="post" navigate={false} fetcherKey="my-key" />
```

### `preventScrollReset`

If you are using [`<ScrollRestoration>`][scroll_restoration_component], this lets you prevent the scroll position from being reset to the top of the window when the form is submitted.

```tsx
<Form preventScrollReset />
```

### `replace`

Replaces the current entry in the history stack, instead of pushing the new entry.

```tsx
<Form replace />
```

### `reloadDocument`

If true, it will submit the form with the browser instead of client side routing. The same as a native `<form>`.

```tsx
<Form reloadDocument />
```

This is recommended over [`<form>`][form_element]. When the `action` prop is omitted, `<Form>` and `<form>` will sometimes call different actions depending on what the current URL is since `<form>` uses the current URL as the default, but `<Form>` uses the URL for the route the form is rendered in.

### `unstable_viewTransition`

The `unstable_viewTransition` prop enables a [View Transition][view-transitions] for this navigation by wrapping the final state update in [`document.startViewTransition()`][document-start-view-transition]. If you need to apply specific styles for this view transition, you will also need to leverage the [`unstable_useViewTransitionState()`][use-view-transition-state].

<docs-warning>
Please note that this API is marked unstable and may be subject to breaking changes without a major release.
</docs-warning>

## Notes

### `?index`

Because index routes and their parent route share the same URL, the `?index` param is used to differentiate between them.

```tsx
<Form action="/accounts?index" method="post" />
```

| action url        | route action                     |
| ----------------- | -------------------------------- |
| `/accounts?index` | `app/routes/accounts._index.tsx` |
| `/accounts`       | `app/routes/accounts.tsx`        |

See also:

- [`?index` query param][index_query_param]

## Additional Resources

**Videos:**

- [Data Mutations with Form + action][data_mutations_with_form_action]
- [Multiple Forms and Single Button Mutations][multiple_forms_and_single_button_mutations]
- [Clearing Inputs After Form Submissions][clearing_inputs_after_form_submissions]

**Related Discussions:**

- [Fullstack Data Flow][fullstack_data_flow]
- [Pending UI][pending_ui]
- [Form vs. Fetcher][form_vs_fetcher]

**Related APIs:**

- [`useActionData`][use_action_data]
- [`useNavigation`][use_navigation]
- [`useSubmit`][use_submit]

[use_navigation]: ../hooks/use-navigation
[scroll_restoration_component]: ./scroll-restoration
[index_query_param]: ../guides/index-query-param
[http_verb]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
[form_element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form
[use_action_data]: ../hooks/use-action-data
[use_submit]: ../hooks/use-submit
[data_mutations_with_form_action]: https://www.youtube.com/watch?v=Iv25HAHaFDs&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6
[multiple_forms_and_single_button_mutations]: https://www.youtube.com/watch?v=w2i-9cYxSdc&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6
[clearing_inputs_after_form_submissions]: https://www.youtube.com/watch?v=bMLej7bg5Zo&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6
[fullstack_data_flow]: ../discussion/data-flow
[pending_ui]: ../discussion/pending-ui
[form_vs_fetcher]: ../discussion/form-vs-fetcher
[use_fetcher]: ../hooks/use-fetcher
[use_fetchers]: ../hooks/use-fetchers
[fetcher_form]: ../hooks/use-fetcher#fetcherform
[progressive_enhancement]: ../discussion/progressive-enhancement
[view-transitions]: https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
[document-start-view-transition]: https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition
[use-view-transition-state]: ../hooks/use-view-transition-state
[relativesplatpath]: ../hooks/use-resolved-path#splat-paths
