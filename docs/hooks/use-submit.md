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
- **unstable_flushSync**: Wraps the initial state update for this navigation in a [`ReactDOM.flushSync`][flush-sync] call instead of the default [`React.startTransition`][start-transition]
- **unstable_viewTransition**: Enables a [View Transition][view-transitions] for this navigation by wrapping the final state update in `document.startViewTransition()`
  - If you need to apply specific styles for this view transition, you will also need to leverage the [`unstable_useViewTransitionState()`][use-view-transition-state]

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
[flush-sync]: https://react.dev/reference/react-dom/flushSync
[start-transition]: https://react.dev/reference/react/startTransition
[view-transitions]: https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API
[use-view-transition-state]: ../hooks//use-view-transition-state
