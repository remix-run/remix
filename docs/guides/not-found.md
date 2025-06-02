---
title: Not Found Handling
---

# Not Found (404) Handling

When a document isn't found on a web server, it should send a [404 status code][404-status-code]. This indicates to machines that the document is not there: search engines won't index it, CDNs won't cache it, etc. Most SPAs today just serve everything as 200 whether the page exists or not, but for you that stops today!

There are two primary cases where a Remix site should send a 404:

- The URL doesn't match any routes in the app
- Your loader didn't find any data

Remix already handles the first case, you don't have to throw a response yourself. It knows your routes, so it knows if nothing matched (_consider using a [Splat Route][splat-route] to handle this case_). The second case is up to you, but it's really easy.

## How to Send a 404

As soon as you know you don't have what the user is looking for, you should _throw a response_.

```tsx filename=app/routes/page.$slug.tsx
export async function loader({
  params,
}: LoaderFunctionArgs) {
  const page = await db.page.findOne({
    where: { slug: params.slug },
  });

  if (!page) {
    throw new Response(null, {
      status: 404,
      statusText: "Not Found",
    });
  }

  return json(page);
}
```

Remix will catch the response and send your app down the [Error Boundary][error-boundary] path. It's actually exactly like Remix's automatic [error handling][errors], but instead of receiving an `Error` from `useRouteError()`, you'll receive an object with your response `status`, `statusText`, and extracted `data`.

What's nice about throwing a response is that code in your loader _stops executing_. The rest of your code doesn't have to deal with the chance that the page is defined or not (this is especially handy for TypeScript).

Throwing also ensures that your route component doesn't render if the loader wasn't successful. Your route components only have to consider the "happy path". They don't need pending states, error states, or in our case here, not-found states.

## Root Error Boundary

You probably already have one at the root of your app. This will handle all thrown responses not handled in a nested route. Here's a sample:

```tsx
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <html>
      <head>
        <title>Oops!</title>
        <Meta />
        <Links />
      </head>
      <body>
        <h1>
          {isRouteErrorResponse(error)
            ? `${error.status} ${error.statusText}`
            : error instanceof Error
            ? error.message
            : "Unknown Error"}
        </h1>
        <Scripts />
      </body>
    </html>
  );
}
```

[error-boundary]: ../route/error-boundary
[errors]: ./errors
[404-status-code]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404
[splat-route]: ../file-conventions/routes#splat-routes
