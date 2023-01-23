---
title: useFormAction
---

# `useFormAction`

<docs-info>This hook is simply a re-export of [React Router's `useFormAction`][rr-useformaction].</docs-info>

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

For more information and usage, please refer to the [React Router `useFormAction` docs][rr-useformaction].

[rr-useformaction]: https://reactrouter.com/hooks/use-form-action
