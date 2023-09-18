---
title: Form
---

# `<Form>`

A progressively enhanced HTML `<form>` wrapper, useful for submissions that should also change the URL or otherwise add an entry to the browser history stack. For forms that shouldn't manipulate the browser history stack, use [`<fetcher.Form>`][fetcher-form].

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

## Props

### `action`

The URL to submit the form data to.

If `undefined`, the action defaults to the closest route in context. If a parent route renders a `<Form>` but the URL matches deeper child routes, the form will post to the parent route. Likewise, a form inside the child route will post to the child route. This differs from a native `<form>` that will always point to the full URL.

### `method`

This determines the [HTTP verb][http-verb] to be used: get, post, put, patch, delete. The default is "get".

```tsx
<Form method="post" />
```

Native `<form>` only supports GET and POST, so you should avoid the other verbs if you'd like to support [progressive enhancement][progressive-enhancement]

### `encType`

The encoding type to use for the form submission.

```tsx
<Form encType="multipart/form-data" />
```

Defaults to `application/x-www-form-urlencoded`, use `multipart/form-data` for file uploads.

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

This is recommended over `<form />`. When the `action` prop is omitted, `<Form>` and `<form>` will sometimes call different actions depending on what the current URL is since `<form>` uses the current URL as the default, but `<Form>` uses the URL for the route the form is rendered in.

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

- [`?index` query param][index query param]

## Additional Resources

**Videos:**

- [Data Mutations with Form + action][data-mutations-with-form-action]
- [Multiple Forms and Single Button Mutations][multiple-forms-and-single-button-mutations]
- [Clearing Inputs After Form Submissions][clearing-inputs-after-form-submissions]

**Related Discussions:**

- [Fullstack Data Flow][fullstack-data-flow]
- [Pending UI][pending-ui]
- [Form vs. Fetcher][form-vs-fetcher]

**Related APIs:**

- [`useNavigation`][usenavigation]
- [`useActionData`][useactiondata]
- [`useSubmit`][usesubmit]

[index query param]: ../guides/routing#what-is-the-index-query-param
[usenavigation]: ../hooks/use-navigation
[useactiondata]: ../hooks/use-action-data
[usesubmit]: ../hooks/use-submit
[http-verb]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
[rr-form]: https://reactrouter.com/components/form
[data-mutations-with-form-action]: https://www.youtube.com/watch?v=Iv25HAHaFDs&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6
[multiple-forms-and-single-button-mutations]: https://www.youtube.com/watch?v=w2i-9cYxSdc&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6
[clearing-inputs-after-form-submissions]: https://www.youtube.com/watch?v=bMLej7bg5Zo&list=PLXoynULbYuEDG2wBFSZ66b85EIspy3fy6
[fullstack-data-flow]: ../discussion/data-flow
[pending-ui]: ../discussion/pending-ui
[form-vs-fetcher]: ../discussion/form-vs-fetcher
[fetcher-form]: ../hooks/use-fetcher
[progressive-enhancement]: ../discussion/progressive-enhancement
