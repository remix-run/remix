---
title: Not Found Handling
---

# Not Found (404) Handling

When a document isn't found on a web server, it should send a [404 status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404). This indicates to machines that the document is there: search engines won't index it, CDNS won't cache it, etc. Most SPAs today just serve everything as 200 whether the page exists or not, but for you that stops today!

There are two primary cases where a Remix site should send a 404:

- The URL doesn't match any routes in the app
- Your loader didn't find any data

The first case is already handled by Remix, you don't have to do anything. It knows your routes so it knows if nothing matched. The second case is up to you, but it's really easy.

## How to Send a 404

As soon as you know you don't have what the user is looking for you should _throw a response_.

```tsx filename=routes/page/$slug.js
export async function loader({ params }) {
  const page = await db.page.findOne({
    where: { slug: params.slug }
  });

  if (!page) {
    throw new Response("Not Found", {
      status: 404
    });
  }

  return page;
}
```

Remix will catch the response and send your app down the [Catch Boundary][catch-boundary] path. It's actually exactly like Remix's automatic [error handling][errors], but instead of exporting an `ErrorBoundary`, you export a `CatchBoundary`.

What's nice about throwing a response is that code in your loader _stops executing_. The rest of your code doesn't have to deal with the chance that the page is defined or not (this is especially handy for TypeScript).

Throwing also ensures that your route component doesn't render if the loader wasn't successful. Your route components only have to consider the "happy path". They don't need pending states, error states, or in our case here, not-found states.

## Root Catch Boundary

You probably already have one at the root of your app. This will handle all thrown responses that weren't handled in a nested route (more on that in a sec). Here's a sample:

```tsx
export function CatchBoundary() {
  const caught = useCatch();
  return (
    <html>
      <head>
        <title>Oops!</title>
        <Meta />
        <Links />
      </head>
      <body>
        <h1>
          {caught.status} {caught.statusText}
        </h1>
        <Scripts />
      </body>
    </html>
  );
}
```

## Nested Catch Boundaries

Just like [errors], nested routes can export their own catch boundary to handle the 404 UI without taking down all of the parent layouts around it, and add some nice UX touches right in context. Bots are happy, SEO is happy, CDNs are happy, users are happy, and your code stays in context, so it seems like everybody involved is happy with this.

```tsx filename=app/routes/pages/$pageId.tsx
import { Form, useLoaderData, useParams } from "remix";

export async function loader({ params }) {
  const page = await db.page.findOne({
    where: { slug: params.slug }
  });

  if (!page) {
    throw new Response("Not Found", {
      status: 404
    });
  }

  return page;
}

export function CatchBoundary() {
  const params = useParams();
  return (
    <div>
      <h2>We couldn't find that page!</h2>
      <Form action="../create">
        <button
          type="submit"
          name="slug"
          value={params.slug}
        >
          Create {params.slug}?
        </button>
      </Form>
    </div>
  );
}

export default function Page() {
  return <PageView page={useLoaderData()} />;
}
```

As you can probably tell, this mechanism isn't just limited to 404s. You can throw any response from a loader or action to send your app down the catch boundary path. For more information, check out the [Catch Boundary][catch-boundary] docs.

[catch-boundary]: ../api/conventions#catchboundary
[errors]: errors
