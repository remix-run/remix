---
title: useNavigation
---

# `useNavigation`

This hook provides information about a pending page navigation.

```js
import { useNavigation } from "@remix-run/react";

function SomeComponent() {
  const navigation = useNavigation();
  // ...
}
```

## Properties

### `navigation.formAction`

The action of the form that was submitted, if any.

```tsx
// set from either one of these
<Form action="/some/where" />;
submit(formData, { action: "/some/where" });
```

### `navigation.formMethod`

The method of the form that was submitted, if any.

```tsx
// set from either one of these
<Form method="get" />;
submit(formData, { method: "get" });
```

### `navigation.formData`

Any `DELETE`, `PATCH`, `POST`, or `PUT` navigation that started from a [`<Form>`][form-component] or [`useSubmit`][use-submit] will have your form's submission data attached to it. This is primarily useful to build "Optimistic UI" with the `submission.formData` [`FormData`][form-data] object.

For example:

```tsx
// This form has the `email` field
<Form method="post" action="/signup">
  <input name="email" />
</Form>;

// So a navigation will have the field's value in `navigation.formData`
// while the navigation is pending.
navigation.formData.get("email");
```

In the case of a `GET` form submission, `formData` will be empty and the data will be reflected in `navigation.location.search`.

### `navigation.location`

This tells you what the next location is going to be.

### `navigation.state`

- **idle** - There is no navigation pending.
- **submitting** - A route action is being called due to a form submission using POST, PUT, PATCH, or DELETE
- **loading** - The loaders for the next routes are being called to render the next page

Normal navigations and GET form submissions transition through these states:

```
idle → loading → idle
```

Form submissions with POST, PUT, PATCH, or DELETE transition through these states:

```
idle → submitting → loading → idle
```

[form-component]: ../components/form
[use-submit]: ./use-submit
[form-data]: https://developer.mozilla.org/en-US/docs/Web/API/FormData
