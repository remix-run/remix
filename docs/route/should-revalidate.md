---
title: shouldRevalidate
---

# `shouldRevalidate`

This function lets apps optimize which routes data should be reloaded after actions and for client-side navigations.

```tsx
import type { ShouldRevalidateFunction } from "@remix-run/react";

export const shouldRevalidate: ShouldRevalidateFunction = ({
  actionResult,
  currentParams,
  currentUrl,
  defaultShouldRevalidate,
  formAction,
  formData,
  formEncType,
  formMethod,
  nextParams,
  nextUrl,
}) => {
  return true;
};
```

<docs-warning>This feature is an <i>additional</i> optimization. In general, Remix's design already optimizes which loaders need to be called and when. When you use this feature, you risk your UI getting out of sync with your server. Use with caution!</docs-warning>

During client-side transitions, Remix will optimize reloading of routes that are already rendering, like not reloading layout routes that aren't changing. In other cases, like form submissions or search param changes, Remix doesn't know which routes need to be reloaded, so it reloads them all to be safe. This ensures your UI always stays in sync with the state on your server.

This function lets apps further optimize by returning `false` when Remix is about to reload a route. If you define this function on a route module, Remix will defer to your function on every navigation and every revalidation after an action is called. Again, this makes it possible for your UI to get out of sync with your server if you do it wrong, so be careful.

`fetcher.load` calls also revalidate, but because they load a specific URL, they don't have to worry about route param or URL search param revalidations. `fetcher.load`'s only revalidate by default after action submissions and explicit revalidation requests via [`useRevalidator`][userevalidator].

## `actionResult`

When a submission causes the revalidation, this will be the result of the action—either action data or an error if the action failed. It's common to include some information in the action result to instruct `shouldRevalidate` to revalidate or not.

```tsx
export async function action() {
  await saveSomeStuff();
  return { ok: true };
}

export function shouldRevalidate({
  actionResult,
  defaultShouldRevalidate,
}) {
  if (actionResult?.ok) {
    return false;
  }
  return defaultShouldRevalidate;
}
```

## `defaultShouldRevalidate`

By default, Remix doesn't call every loader all the time. There are reliable optimizations it can make by default. For example, only loaders with changing params are called. Consider navigating from the following URL to the one below it:

- `/projects/123/tasks/abc`
- `/projects/123/tasks/def`

Remix will only call the loader for `tasks/def` because the param for `projects/123` didn't change.

It's safest to always return `defaultShouldRevalidate` after you've done your specific optimizations that return `false`, otherwise your UI might get out of sync with your data on the server.

```tsx
export function shouldRevalidate({
  defaultShouldRevalidate,
}) {
  if (whateverConditionsYouCareAbout) {
    return false;
  }

  return defaultShouldRevalidate;
}
```

This is more dangerous, but YOLO:

```tsx
export function shouldRevalidate() {
  return whateverConditionsYouCareAbout;
}
```

## `currentParams`

These are the [URL params][url-params] from the URL that can be compared to the `nextParams` to decide if you need to reload or not. Perhaps you're using only a partial piece of the param for data loading, you don't need to revalidate if a superfluous part of the param changed.

For instance, consider an event slug with the id and a human-friendly title:

- `/events/blink-182-united-center-saint-paul--ae3f9`
- `/events/blink-182-little-caesars-arena-detroit--e87ad`

```tsx filename=app/routes/events.$slug.tsx
export async function loader({
  params,
}: LoaderFunctionArgs) {
  const id = params.slug.split("--")[1];
  return loadEvent(id);
}

export function shouldRevalidate({
  currentParams,
  nextParams,
  defaultShouldRevalidate,
}) {
  const currentId = currentParams.slug.split("--")[1];
  const nextId = nextParams.slug.split("--")[1];
  if (currentId === nextId) {
    return false;
  }

  return defaultShouldRevalidate;
}
```

## `currentUrl`

This is the url the navigation started from.

## `nextParams`

In the case of navigation, these are the [URL params][url-params] from the next location the user is requesting. Some revalidations are not navigation, so it will simply be the same as `currentParams`.

## `nextUrl`

In the case of navigation, this is the URL the user is requesting. Some revalidations are not navigation, so it will simply be the same as `currentUrl`.

## `formMethod`

The method (probably `"GET"` or `"POST"`) used from the form submission that triggered the revalidation.

## `formAction`

The form action (`<Form action="/somewhere">`) that triggered the revalidation.

## `formData`

The data submitted with the form that triggered the revalidation.

## Use Cases

### Never reloading the root

It's common for root loaders to return data that never changes, like environment variables, to be sent to the client app. In these cases you never need the root loader to be called again. For this case, you can simply `return false`.

```tsx lines=[10]
export const loader = async () => {
  return json({
    ENV: {
      CLOUDINARY_ACCT: process.env.CLOUDINARY_ACCT,
      STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
    },
  });
};

export const shouldRevalidate = () => false;
```

With this in place, Remix will no longer make a request to your root loader for any reason, not after form submissions, not after search param changes, etc.

### Ignoring search params

Another common case is when you've got nested routes and a child component has a feature that uses the search params in the URL, like a search page or some tabs with state you want to keep in the search params.

Consider these routes:

```
├── $projectId.tsx
└── $projectId.activity.tsx
```

And let's say the UI looks something like this:

```
+------------------------------+
|    Project: Design Revamp    |
+------------------------------+
|  Tasks | Collabs | >ACTIVITY |
+------------------------------+
|  Search: _____________       |
|                              |
|  - Ryan added an image       |
|                              |
|  - Michael commented         |
|                              |
+------------------------------+
```

The `$projectId.activity.tsx` loader can use the search params to filter the list, so visiting a URL like `/projects/design-revamp/activity?search=image` could filter the list of results. Maybe it looks something like this:

```tsx filename=app/routes/$projectId.activity.tsx lines=[11]
export async function loader({
  params,
  request,
}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  return json(
    await exampleDb.activity.findAll({
      where: {
        projectId: params.projectId,
        name: {
          contains: url.searchParams.get("search"),
        },
      },
    })
  );
}
```

This is great for the activity route, but Remix doesn't know if the parent loader, `$projectId.tsx` _also_ cares about the search params. That's why Remix does the safest thing and reloads all the routes on the page when the search params change.

In this UI, that's wasted bandwidth for the user, your server, and your database because `$projectId.tsx` doesn't use the search params. Consider that our loader for `$projectId.tsx` looks something like this:

```tsx filename=app/routes/$projectId.tsx
export async function loader({
  params,
}: LoaderFunctionArgs) {
  const data = await fakedb.findProject(params.projectId);
  return json(data);
}
```

There are a lot of ways to do this. The rest of the code in the app matters, but ideally, you don't think about the UI you're trying to optimize (the search params changing) but instead look at the values your loader cares about. In our case, it only cares about the projectId, so we can check two things:

- did the params stay the same?
- was it a `GET` and not a mutation?

If the params didn't change, and we didn't do a `POST`, then we know our loader will return the same data it did last time, so we can opt out of the revalidation when the child route changes the search params.

```tsx filename=app/routes/$projectId.tsx
export function shouldRevalidate({
  currentParams,
  nextParams,
  formMethod,
  defaultShouldRevalidate,
}) {
  if (
    formMethod === "GET" &&
    currentParams.projectId === nextParams.projectId
  ) {
    return false;
  }

  return defaultShouldRevalidate;
}
```

[url-params]: ../file-conventions/routes#dynamic-segments
[userevalidator]: ../hooks/use-revalidator
