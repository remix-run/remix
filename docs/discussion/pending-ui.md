---
title: Pending UI
order: 8
---

# Pending and Optimistic UI

The difference between a great user experience on the web and mediocre one is how well the developer implements network-aware user interface feedback by providing visual cues during network-intensive actions. There are three main types of pending UI: busy indicators, optimistic UI, and skeleton fallbacks. This document provides guidelines for selecting and implementing the appropriate feedback mechanism based on specific scenarios.

## Pending UI Feedback Mechanisms

**Busy Indicators**: Busy indicators display visual cues to users while an action is being processed by the server. This feedback mechanism is used when the application cannot predict the outcome of the action and must wait for the server's response before updating the UI.

**Optimistic UI**: Optimistic UI enhances perceived speed and responsiveness by immediately updating the UI with an expected state before the server's response is received. This approach is used when the application can predict the outcome of an action based on context and user input, allowing for an immediate response to actions.

**Skeleton Fallbacks**: Skeleton fallbacks are used when the UI is initially loading, providing users with a visual placeholder that outlines the structure of the upcoming content. This feedback mechanism is particularly useful to render something useful as soon as possible.

## Guiding Principles for Feedback Selection

Use Optimistic UI:

- **Remix State Predictability**: The application can accurately predict the remix state of the UI based on the user's action.
- **Error Handling**: Robust error handling mechanisms are in place to address potential errors that may occur during the process.
- **URL Stability**: The action does not result in a change of the URL, ensuring that the user remains within the same page.

Use Busy Indicators:

- **Remix State Uncertainty**: The outcome of the action cannot be reliably predicted, necessitating waiting for the server's response.
- **URL Change**: The action leads to a change in the URL, indicating navigation to a new page or section.
- **Error Boundaries**: The error handling approach primarily relies on error boundaries that manage exceptions and unexpected behavior.
- **Side Effects**: The action triggers side effects that involve critical processes, such as sending email, processing payments, etc.

Use Skeleton Fallbacks:

- **Initial Loading**: The UI is in the process of loading, providing users with a visual indication of upcoming content structure.
- **Critical Data**: The data is not critical for the initial rendering of the page, allowing the skeleton fallback to be displayed while the data is loading.
- **App-Like Feel**: The application is designed to resemble the behavior of a standalone app, allowing for immediate transitions to the fallbacks.

## Examples

### Page Navigation

**Busy Indicator**: You can indicate the user is navigating to a new page with [`useNavigation`][use_navigation]:

```tsx
import { useNavigation } from "@remix-run/react";

function PendingNavigation() {
  const navigation = useNavigation();
  return navigation.state === "loading" ? (
    <div className="spinner" />
  ) : null;
}
```

### Pending Links

**Busy Indicator**: You can indicate on the nav link itself that the user is navigating to it with the [`<NavLink className>`][nav_link_component_classname] callback.

```tsx lines=[10-12]
import { NavLink } from "@remix-run/react";

export function ProjectList({ projects }) {
  return (
    <nav>
      {projects.map((project) => (
        <NavLink
          key={project.id}
          to={project.id}
          className={({ isPending }) =>
            isPending ? "pending" : null
          }
        >
          {project.name}
        </NavLink>
      ))}
    </nav>
  );
}
```

Or add a spinner remix to it by inspecting params:

```tsx lines=[1,4,10-12]
import { useParams } from "@remix-run/react";

export function ProjectList({ projects }) {
  const params = useParams();
  return (
    <nav>
      {projects.map((project) => (
        <NavLink key={project.id} to={project.id}>
          {project.name}
          {params.projectId === project.id ? (
            <Spinner />
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}
```

While localized indicators on links are nice, they are incomplete. There are many other ways a navigation can be triggered: form submissions, back and forward button clicks in the browser, action redirects, and imperative `navigate(path)` calls, so you'll typically want a global indicator to capture everything.

### Record Creation

**Busy Indicator**: It's typically best to wait for a record to be created instead of using optimistic UI since things like IDs and other fields are unknown until it completes. Also note this action redirects to the new record from the action.

```tsx filename=app/routes/create-project.tsx lines=[2,13,21-22,26,35]
import type { ActionFunctionArgs } from "@remix-run/node"; // or cloudflare/deno
import { redirect } from "@remix-run/node"; // or cloudflare/deno
import { useNavigation } from "@remix-run/react";

export async function action({
  request,
}: ActionFunctionArgs) {
  const formData = await request.formData();
  const project = await createRecord({
    name: formData.get("name"),
    owner: formData.get("owner"),
  });
  return redirect(`/projects/${project.id}`);
}

export default function CreateProject() {
  const navigation = useNavigation();

  // important to check you're submitting to the action
  // for the pending UI, not just any action
  const isSubmitting =
    navigation.formAction === "/create-project";

  return (
    <Form method="post" action="/create-project">
      <fieldset disabled={isSubmitting}>
        <label>
          Name: <input type="text" name="projectName" />
        </label>
        <label>
          Owner: <UserSelect />
        </label>
        <button type="submit">Create</button>
      </fieldset>
      {isSubmitting ? <BusyIndicator /> : null}
    </Form>
  );
}
```

You can do the same with [`useFetcher`][use_fetcher], which is useful if you aren't changing the URL (maybe adding the record to a list)

```tsx lines=[5]
import { useFetcher } from "@remix-run/react";

function CreateProject() {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state === "submitting";

  return (
    <fetcher.Form method="post" action="/create-project">
      {/* ... */}
    </fetcher.Form>
  );
}
```

### Record Updates

**Optimistic UI**: When the UI simply updates a field on a record, optimistic UI is a great choice. Many, if not most user interactions in a web app tend to be updates, so this is a common pattern.

```tsx lines=[6-8,19,22]
import { useFetcher } from "@remix-run/react";

function ProjectListItem({ project }) {
  const fetcher = useFetcher();

  const starred = fetcher.formData
    ? // use optimistic value if submitting
      fetcher.formData.get("starred") === "1"
    : // fall back to the database state
      project.starred;

  return (
    <>
      <div>{project.name}</div>
      <fetcher.Form method="post">
        <button
          type="submit"
          name="starred"
          // use optimistic value to allow interruptions
          value={starred ? "0" : "1"}
        >
          {/* 👇 display optimistic value */}
          {starred ? "★" : "☆"}
        </button>
      </fetcher.Form>
    </>
  );
}
```

## Deferred Data Loading

**Skeleton Fallback**: When data is deferred, you can add fallbacks with [`<Suspense>`][suspense_component]. This allows the UI to render without waiting for the data to load, speeding up the perceived and actual performance of the application.

```tsx lines=[11-14,24-28]
import type { LoaderFunctionArgs } from "@remix-run/node"; // or cloudflare/deno
import { defer } from "@remix-run/node"; // or cloudflare/deno
import { Await } from "@remix-run/react";
import { Suspense } from "react";

export async function loader({
  params,
}: LoaderFunctionArgs) {
  const reviewsPromise = getReviews(params.productId);
  const product = await getProduct(params.productId);
  return defer({
    product: product,
    reviews: reviewsPromise,
  });
}

export default function ProductRoute() {
  const { product, reviews } =
    useLoaderData<typeof loader>();
  return (
    <>
      <ProductPage product={product} />

      <Suspense fallback={<ReviewsSkeleton />}>
        <Await resolve={reviews}>
          {(reviews) => <Reviews reviews={reviews} />}
        </Await>
      </Suspense>
    </>
  );
}
```

When creating skeleton fallbacks, consider the following principles:

- **Consistent Size:** Ensure that the skeleton fallbacks match the dimensions of the actual content. This prevents sudden layout shifts, providing a smoother and more visually cohesive loading experience. In terms of web performance, this trade-off minimizes [Cumulative Layout Shift][cumulative_layout_shift] (CLS) in favor of improving [First Contentful Paint][first_contentful_paint] (FCP). You can minimize the trade with accurate dimensions in the fallback.
- **Critical Data:** Avoid using fallbacks for essential information—the main content of the page. This is especially important for SEO and meta tags. If you delay showing critical data, accurate meta tags can't be provided, and search engines won't correctly index your page.
- **App-Like Feel**: For web application UI that doesn't have SEO concerns, it can be beneficial to use skeleton fallbacks more extensively. This creates an interface that resembles the behavior of a standalone app. When users click on links, they get an instantaneous transition to the skeleton fallbacks.
- **Link Prefetching:** Using [`<Link prefetch="intent">`][link-component-prefetch] can often skip the fallbacks completely. When users hover or focus on the link, this method preloads the needed data, allowing the network a quick moment to fetch content before the user clicks. This often results in an immediate navigation to the remix page.

## Conclusion

Creating network-aware UI via busy indicators, optimistic UI, and skeleton fallbacks significantly improves the user experience by showing visual cues during actions that require network interaction. Getting good at this is the best way to build applications your users trust.

[use_navigation]: ../hooks/use-navigation
[nav_link_component_classname]: ../components/nav-link#classname-callback
[use_fetcher]: ../hooks/use-fetcher
[suspense_component]: https://react.dev/reference/react/Suspense
[cumulative_layout_shift]: https://web.dev/cls
[first_contentful_paint]: https://web.dev/fcp
[link-component-prefetch]: ../components/link#prefetch
