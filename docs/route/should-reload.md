---
title: unstable_shouldReload
hidden: true
---

# `unstable_shouldReload`

<docs-error>This API has been stabilized as [`shouldRevalidate`][shouldrevalidate], you should use it instead. This hook is no longer called starting in v1.10.0</docs-error>

---

This function lets apps optimize which routes should be reloaded on some client-side transitions in v1.9.x and lower.

```tsx
import type { ShouldReloadFunction } from "@remix-run/react";

export const unstable_shouldReload: ShouldReloadFunction =
  ({
    // same params that go to `loader` and `action`
    params,

    // a possible form submission that caused this to be reloaded
    submission,

    // the next URL being used to render this page
    url,

    // the previous URL used to render this page
    prevUrl,
  }) => false; // or `true`;
```

During client-side transitions, Remix will optimize reloading of routes that are already rendering, like not reloading layout routes that aren't changing. In other cases, like form submissions or search param changes, Remix doesn't know which routes need to be reloaded, so it reloads them all to be safe. This ensures data mutations from the submission or changes in the search params are reflected across the entire page.

This function lets apps further optimize by returning `false` when Remix is about to reload a route. There are three cases when Remix will reload a route, and you have the opportunity to optimize:

- if the `url.search` changes (while the `url.pathname` is the same)
- after actions are called
- "refresh" link clicks (click link to same URL)

Otherwise, Remix will reload the route, and you have no choice:

- A route matches the new URL that didn't match before
- The `url.pathname` changed (including route params)

Here are a couple of common use-cases:

#### Never reloading the root

It's common for root loaders to return data that never changes, like environment variables to be sent to the client app. In these cases you never need the root loader to be called again. For this case, you can simply `return false`.

```tsx lines=[10]
export const loader = async () => {
  return json({
    ENV: {
      CLOUDINARY_ACCT: process.env.CLOUDINARY_ACCT,
      STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
    },
  });
};

export const unstable_shouldReload = () => false;
```

With this in place, Remix will no longer make a request to your root loader for any reason, not after form submissions, not after search param changes, etc.

#### Ignoring search params

Another common case is when you've got nested routes and a child component has a feature that uses the search params in the URL, like a search page or some tabs with state you want to keep in the search params.

Consider these routes:

```
└── $projectId.tsx
    └── activity.tsx
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

The `activity.tsx` loader can use the search params to filter the list, so visiting a URL like `/projects/design-revamp/activity?search=image` could filter the list of results. Maybe it looks something like this:

```tsx lines=[2,8]
export async function loader({
  params,
  request,
}: LoaderArgs) {
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

```tsx
export async function loader({ params }: LoaderArgs) {
  return json(await fakedb.findProject(params.projectId));
}
```

We want this loader to be called only if the project has had an update, so we can make this really simple and just say to reload if there is a non-GET submission:

```tsx
export function unstable_shouldReload({ submission }) {
  return !!submission && submission.method !== "GET";
}
```

Now if the child route causes the search params to change, this route will no longer be reloaded because there was no submission.

<docs-info>When you want to optimize a loader, instead of thinking about the thing causing the reload (search params), think only about the loader's requirements that you're optimizing.</docs-info>

You may want to get more granular and reload only for submissions to this project:

```tsx
export function unstable_shouldReload({
  params,
  submission,
}) {
  return !!(
    submission &&
    submission.action === `/projects/${params.projectId}`
  );
}
```

You need to be very careful here, though. That project (or its nested relationships) may be updated by other actions and your app will get out of sync if you don't also consider them.

[shouldrevalidate]: ./should-revalidate
