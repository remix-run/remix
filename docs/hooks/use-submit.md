---
title: useSubmit
---

# `useSubmit`

The imperative version of `<Form>` that lets you, the programmer, submit a form instead of the user.

```tsx
import { useSubmit } from "@remix-run/react";

function SomeComponent() {
  const submit = useSubmit();
  return (
    <Form
      onChange={(event) => {
        submit(event.currentTarget);
      }}
    />
  );
}
```

## Signature

```tsx
submit(targetOrData, options);
```

### `targetOrData`

Can be any of the following:

**HTMLFormElement instance**

```tsx
<Form
  onSubmit={(event) => {
    submit(event.currentTarget);
  }}
/>
```

**`FormData` instance**

```tsx
const formData = new FormData();
formData.append("myKey", "myValue");
submit(formData);
```

**Plain object that will be serialized as `FormData`**

```tsx
submit({ myKey: "myValue" });
```

### `options`

Options for the submission, the same as `<Form>` props. All options are optional.

- **action**: The href to submit to. Default is the current route path.
- **method**: The HTTP method to use like POST, default is GET.
- **encType**: The encoding type to use for the form submission: `application/x-www-form-urlencoded` or `multipart/form-data`. Default is url encoded.
- **navigate**: Specify `false` to submit using a fetcher instead of performing a navigation
- **fetcherKey**: The fetcher key to use when submitting using a fetcher via `navigate: false`
- **preventScrollReset**: Prevents the scroll position from being reset to the top of the window when the data is submitted. Default is `false`.
- **replace**: Replaces the current entry in the history stack, instead of pushing the new entry. Default is `false`.
- **relative**: Defines relative route resolution behavior. Either `"route"` (relative to the route hierarchy) or `"path"` (relative to the URL).

```tsx
submit(data, {
  action: "",
  method: "post",
  encType: "application/x-www-form-urlencoded",
  preventScrollReset: false,
  replace: false,
  relative: "route",
});
```

## Additional Resources

**Discussion**

- [Form vs. Fetcher][form-vs-fetcher]

**Related API**

- [`<Form>`][form]
- [`fetcher.submit`][fetcher-submit]

[form-vs-fetcher]: ../discussion/form-vs-fetcher
[form]: ../components/form
[fetcher-submit]: ../hooks/use-fetcher#fetchersubmitformdata-options
