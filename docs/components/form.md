---
title: Form
---

# `<Form>`

<docs-info>This component is simply a re-export of [React Router's `Form`][rr-form].</docs-info>

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
- `<Form>` automatically serializes your form's values (identically to the browser when not using JavaScript).
- You can build "optimistic UI" and pending indicators with [`useNavigation`][usenavigation].

## `action`

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

## `method`

This determines the [HTTP verb][http-verb] to be used: get, post, put, patch, delete. The default is "get".

```tsx
<Form method="post" />
```

Native `<form>` only supports get and post, so if you want your form to work with JavaScript on or off the page you'll need to stick with those two.

Without JavaScript, Remix will turn non-get requests into "post", but you'll still need to instruct your server with a hidden input like `<input type="hidden" name="_method" value="delete" />`. If you always include JavaScript, you don't need to worry about this.

<docs-info>We generally recommend sticking with "get" and "post" because the other verbs are not supported by HTML</docs-info>

## `encType`

Defaults to `application/x-www-form-urlencoded`, use `multipart/form-data` for file uploads.

## `replace`

```tsx
<Form replace />
```

Instructs the form to replace the current entry in the history stack, instead of pushing the new entry. If you expect a form to be submitted multiple times you may not want the user to have to click "back" for every submission to get to the previous page.

<docs-warning>This has no effect without JavaScript on the page.</docs-warning>

## `reloadDocument`

If true, it will submit the form with the browser instead of JavaScript, even if JavaScript is on the page.

```tsx
<Form reloadDocument />
```

<docs-info>This is recommended over <code>\<form></code></docs-info>

When the `action` prop is omitted, `<Form>` and `<form>` will sometimes call different actions depending on what the current URL is.

- `<form>` uses the current URL as the default which can lead to surprising results: forms inside parent routes will post to the child action if you're at the child's URL and the parents action when you're at the parent's URL. This means as the user navigates, the form's behavior changes.
- `<Form>` will always post to the route's action, independent of the URL. A form in a parent route will always post to the parent, even if you're at the child's URL.

<docs-info>For more information and usage, please refer to the [React Router `Form` docs][rr-form].</docs-info>

See also:

- [`useNavigation`][usenavigation]
- [`useActionData`][useactiondata]
- [`useSubmit`][usesubmit]

[index query param]: ../guides/routing#what-is-the-index-query-param
[usenavigation]: ../hooks/use-navigation
[useactiondata]: ../hooks/use-action-data
[usesubmit]: ../hooks/use-submit
[http-verb]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods
[rr-form]: https://reactrouter.com/components/form
