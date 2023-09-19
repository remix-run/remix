---
title: Index Query Param
toc: false
---

# Index Query Param

You may find a wild `?index` appear in the URL of your app when submitting forms.

Because of nested routes, multiple routes in your route hierarchy can match the URL. Unlike navigations where all matching route [`loader`][loader]s are called to build up the UI, when a [`form`][form_element] is submitted _only one action is called_.

Because index routes share the same URL as their parent, the `?index` param lets you disambiguate between the two.

For example, consider the following forms:

```tsx
<Form method="post" action="/projects" />;
<Form method="post" action="/projects?index" />;
```

The `?index` param will submit to the index route, the [`action`][form_component_action] without the index param will submit to the parent route.

When a [`<Form>`][form_component] is rendered in an index route without an [`action`][action], the `?index` param will automatically be appended so that the form posts to the index route. The following form, when submitted, will post to `/projects?index` because it is rendered in the context of the projects index route:

```tsx filename=app/routes/projects._index.tsx
function ProjectsIndex() {
  return <Form method="post" />;
}
```

If you moved the code to the `ProjectsLayout` route, it would instead post to `/projects`.

This applies to `<Form>` and all of its cousins:

```tsx
function Component() {
  const submit = useSubmit();
  submit({}, { action: "/projects" });
  submit({}, { action: "/projects?index" });
}
```

```tsx
function Component() {
  const fetcher = useFetcher();
  fetcher.submit({}, { action: "/projects" });
  fetcher.submit({}, { action: "/projects?index" });
  <fetcher.Form action="/projects" />;
  <fetcher.Form action="/projects?index" />;
  <fetcher.Form />; // defaults to the route in context
}
```

[loader]: ../route/loader
[form_element]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form
[form_component_action]: ../components/form#action
[form_component]: ../components/form
[action]: ../route/action
