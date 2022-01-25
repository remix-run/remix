---
title: Resource Routes
---

# Resource Routes

Resource Routes are not part of your application UI, but are still part of your application. They can send any kind of Response.

Most routes in Remix are UI Routes, or routes that actually render a component. But routes don't always have to render components. There are a handful of cases where you want to use route as a general purpose endpoint to your website. Here are a few examples:

- JSON API for a mobile app that reuses server-side code with the Remix UI
- Dynamically generating PDFs
- Dynamically generating social images for blog posts or other pages
- Webhooks for other services like Stripe or GitHub
- a CSS file that dynamically renders custom properties for a user's preferred theme

## Creating Resource Routes

If a route doesn't export a default component, it can be used as a Resource Route. If called with `GET`, the loader's response is returned and none of the parent route loaders are called either (because those are needed for the UI, but this is not the UI). If called with `POST`, the action's response is called.

For example, consider a UI Route that renders a report, note the link:

```tsx lines=[10-12] filename=app/routes/reports/$id.js
export function loader({ params }) {
  return getReport(params.id);
}

export default function Report() {
  const report = useLoaderData();
  return (
    <div>
      <h1>{report.name}</h1>
      <Link to="pdf" reloadDocument>
        View as PDF
      </Link>
      {/* ... */}
    </div>
  );
}
```

It's linking to a PDF version of the page. To make this work we can create a Resource Route below it. Notice that it has no component: that makes it a Resource Route.

```tsx filename=app/routes/reports/$id/pdf.ts
export function loader({ params }) {
  const report = await getReport(params.id);
  const pdf = await generateReportPDF(report);
  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf"
    }
  });
}
```

When the user clicks the link from the UI route, they will navigate to the PDF.

## Linking to Resource Routes

<docs-error>It’s imperative that you use <code>reloadDocument</code> on any Links to Resource Routes</docs-error>

There's a subtle detail to be aware of when linking to resource routes. You need to link to it with `<Link reloadDocument>` or a plain `<a href>`. If you link to it with a normal `<Link to="pdf">` without `reloadDocument`, then the resource route will be treated as a UI route. Remix will try to get the data with `fetch` and render the component. Don't sweat it too much, you'll get a helpful error message if you make this mistake.

## URL Escaping

You'll probably want to add a file extension to your resource routes. This is tricky because one of Remix's route file naming conventions is that `.` becomes `/` so you can nest the URL without nesting the UI.

To add a `.` to a route's path, use the `[]` escape characters. Our PDF route file name would change like so:

```sh
# original
# /reports/123/pdf
app/routes/reports/$id/pdf.ts

# with a file extension
# /reports/123.pdf
app/routes/reports/$id/[.pdf].ts

# or like this, the resulting URL is the same
app/routes/reports/$id.[.pdf].ts
```

## Handling different request methods

To handle `GET` requests export a loader function:

```ts
import type { LoaderFunction } from "remix";

export const loader: LoaderFunction = ({ request }) => {
  // handle "GET" request

  return json({ success: true }, 200);
};
```

To handle `POST`, `PUT`, `PATCH` or `DELETE` requests export an action function:

```ts
import type { ActionFunction } from "remix";

export const action: ActionFunction = ({ request }) => {
  switch (request.method) {
    case "POST": {
      /* handle "POST" */
    }
    case "PUT": {
      /* handle "PUT" */
    }
    case "PATCH": {
      /* handle "PATCH" */
    }
    case "DELETE": {
      /* handle "DELETE" */
    }
  }
};
```

## Webhooks

Resource routes can be used to handle webhooks. For example, you can create a webhook that receives notifications from GitHub when a new commit is pushed to a repository:

```ts
import { ActionFunction, json } from "remix";
import crypto from "crypto";

export const action: ActionFunction = async ({
  request
}) => {
  if (request.method !== "POST") {
    return json({ message: "Method not allowed" }, 405);
  }
  const payload = await request.json();

  /* Validate the webhook */
  const signature = request.headers.get(
    "X-Hub-Signature-256"
  );
  const generatedSignature = `sha256=${crypto
    .createHmac("sha256", process.env.GITHUB_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex")}`;
  if (signature !== generatedSignature) {
    return json({ message: "Signature mismatch" }, 401);
  }

  /* process the webhook (e.g. enqueue a background job) */

  return json({ success: true }, 200);
};
```
