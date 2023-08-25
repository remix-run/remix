---
title: Form
---

# `<Form>`

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
- After a `<Form>` submission, all the loaders on the page will be reloaded. This ensures that any updates to your data are reflected in the UI.
- `<Form>` automatically serializes your form's values (identically to the browser when not using JavaScript).
- You can build "optimistic UI" and pending indicators with [`useNavigation`][usenavigation].

## Props

### `action`

Most of the time you can omit this prop. Forms without an action prop (`<Form method="post">`) will automatically post to the same route within which they are rendered. This makes collocating your component, your data reads, and your data writes a snap.

If you need to post to a different route, then add an action prop:

```tsx
<Form action="/projects/new" method="post" />
```

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

### `method`

This determines the [HTTP verb][http-verb] to be used: get, post, put, patch, delete. The default is "get".

```tsx
<Form method="post" />
```

Native `<form>` only supports get and post, so if you want your form to work with JavaScript on or off the page you'll need to stick with those two.

Without JavaScript, Remix will turn non-get requests into "post", but you'll still need to instruct your server with a hidden input like `<input type="hidden" name="_method" value="delete" />`. If you always include JavaScript, you don't need to worry about this.

We generally recommend sticking with "get" and "post" because the other verbs are not supported by HTML.

### `encType`

Defaults to `application/x-www-form-urlencoded`, use `multipart/form-data` for file uploads.

### `replace`

```tsx
<Form replace />
```

Instructs the form to replace the current entry in the history stack, instead of pushing the new entry. If you expect a form to be submitted multiple times you may not want the user to have to click "back" for every submission to get to the previous page.

This has no effect without JavaScript on the page.

### `reloadDocument`

If true, it will submit the form with the browser instead of JavaScript, even if JavaScript is on the page, the same as a native `<form>`.

```tsx
<Form reloadDocument />
```

This is recommended over `<form />`. When the `action` prop is omitted, `<Form>` and `<form>` will sometimes call different actions depending on what the current URL is since `<form>` uses the current URL as the default, but `<Form>` uses the URL for the route the form is rendered in.

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
[fullstack-data-flow]: ../discussion/03-data-flow
[pending-ui]: ../discussion/07-pending-ui
[form-vs-fetcher]: ../discussion/10-form-vs-fetcher
