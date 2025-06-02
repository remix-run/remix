---
title: FAQs
description: Frequently Asked Questions about Remix
---

# Frequently Asked Questions

## How can I have a parent route loader validate the user and protect all child routes?

You can't 😅. During a client-side transition, to make your app as speedy as possible, Remix will call all of your loaders _in parallel_, in separate fetch requests. Each one of them needs to have its own authentication check.

This is probably not different from what you were doing before Remix, it might just be more obvious now. Outside of Remix, when you make multiple fetches to your "API Routes", each of those endpoints needs to validate the user session. In other words, Remix route loaders are their own "API Route" and must be treated as such.

We recommend you create a function that validates the user session that can be added to any routes that require it.

```ts filename=app/session.ts lines=[9-22]
import {
  createCookieSessionStorage,
  redirect,
} from "@remix-run/node"; // or cloudflare/deno

// somewhere you've got a session storage
const { getSession } = createCookieSessionStorage();

export async function requireUserSession(request) {
  // get the session
  const cookie = request.headers.get("cookie");
  const session = await getSession(cookie);

  // validate the session, `userId` is just an example, use whatever value you
  // put in the session when the user authenticated
  if (!session.has("userId")) {
    // if there is no user session, redirect to login
    throw redirect("/login");
  }

  return session;
}
```

And now in any loader or action that requires a user session, you can call the function.

```tsx filename=app/routes/projects.tsx lines=[5]
export async function loader({
  request,
}: LoaderFunctionArgs) {
  // if the user isn't authenticated, this will redirect to login
  const session = await requireUserSession(request);

  // otherwise the code continues to execute
  const projects = await fakeDb.projects.scan({
    userId: session.get("userId"),
  });
  return json(projects);
}
```

Even if you don't need the session information, the function will still protect the route:

```tsx
export async function loader({
  request,
}: LoaderFunctionArgs) {
  await requireUserSession(request);
  // continue
}
```

## How do I handle multiple forms in one route?

[Watch on YouTube][watch_on_youtube]

In HTML, forms can post to any URL with the action prop, and the app will navigate there:

```tsx
<Form action="/some/where" />
```

In Remix the action defaults to the route that the form is rendered in, making it easy to co-locate the UI and the server code that handles it. Developers often wonder how you can handle multiple actions in this scenario. You have two choices:

1. Send a form field to determine the action you want to take
2. Post to a different route and redirect back to the original

We find option (1) to be the simplest because you don't have to mess around with sessions to get validation errors back to the UI.

HTML buttons can send a value, so it's the easiest way to implement this:

```tsx filename=app/routes/projects.$id.tsx lines=[5-6,35,41]
export async function action({
  request,
}: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  switch (intent) {
    case "update": {
      // do your update
      return updateProjectName(formData.get("name"));
    }
    case "delete": {
      // do your delete
      return deleteStuff(formData);
    }
    default: {
      throw new Error("Unexpected action");
    }
  }
}

export default function Projects() {
  const project = useLoaderData<typeof loader>();
  return (
    <>
      <h2>Update Project</h2>
      <Form method="post">
        <label>
          Project name:{" "}
          <input
            type="text"
            name="name"
            defaultValue={project.name}
          />
        </label>
        <button type="submit" name="intent" value="update">
          Update
        </button>
      </Form>

      <Form method="post">
        <button type="submit" name="intent" value="delete">
          Delete
        </button>
      </Form>
    </>
  );
}
```

<docs-warning>Older browser versions might break this functionality because they might not support the [SubmitEvent: submitter property][submitevent-submitter] or the [FormData() constructor submitter parameter][formdata-submitter]. Be sure to check the browser compatibility for these features. If you need to polyfill this, please refer to the [Event Submitter Polyfill][polyfill-event-submitter] and the [FormData Submitter Polyfill][polyfill-formdata-submitter]. For more details, see the related issue [remix-run/remix#9704][remix-submitter-issue].</docs-warning>

## How can I have structured data in a form?

If you're used to doing fetches with a content type of `application/json`, you may wonder how forms fit into this. [`FormData`][form_data] is a bit different from JSON.

- It can't have nested data, it's just "key value".
- It _can_ have multiple entries on one key, unlike JSON.

If you're wanting to send structured data simply to post arrays, you can use the same key on multiple inputs:

```tsx
<Form method="post">
  <p>Select the categories for this video:</p>
  <label>
    <input type="checkbox" name="category" value="comedy" />{" "}
    Comedy
  </label>
  <label>
    <input type="checkbox" name="category" value="music" />{" "}
    Music
  </label>
  <label>
    <input type="checkbox" name="category" value="howto" />{" "}
    How-To
  </label>
</Form>
```

Each checkbox has the name: "category". Since `FormData` can have multiple values on the same key, you don't need JSON for this. Access the checkbox values with `formData.getAll()` in your action.

```tsx
export async function action({
  request,
}: ActionFunctionArgs) {
  const formData = await request.formData();
  const categories = formData.getAll("category");
  // ["comedy", "music"]
}
```

Using the same input name and `formData.getAll()` covers most cases for wanting to submit structured data in your forms.

If you still want to submit nested structures as well, you can use non-standard form-field naming conventions and the [`query-string`][query_string] package from npm:

```tsx
<>
  // arrays with []
  <input name="category[]" value="comedy" />
  <input name="category[]" value="comedy" />
  // nested structures parentKey[childKey]
  <input name="user[name]" value="Ryan" />
</>
```

And then in your action:

```tsx
import queryString from "query-string";

// in your action:
export async function action({
  request,
}: ActionFunctionArgs) {
  // use `request.text()`, not `request.formData` to get the form data as a url
  // encoded form query string
  const formQueryString = await request.text();

  // parse it into an object
  const obj = queryString.parse(formQueryString);
}
```

Some folks even dump their JSON into a hidden field. Note that this approach won't work with progressive enhancement. If that's not important to your app, this is an easy way to send structured data.

```tsx
<input
  type="hidden"
  name="json"
  value={JSON.stringify(obj)}
/>
```

And then parse it in the action:

```tsx
export async function action({
  request,
}: ActionFunctionArgs) {
  const formData = await request.formData();
  const obj = JSON.parse(formData.get("json"));
}
```

Again, `formData.getAll()` is often all you need, we encourage you to give it a try!

[form_data]: https://developer.mozilla.org/en-US/docs/Web/API/FormData
[query_string]: https://npm.im/query-string
[ramda]: https://npm.im/ramda
[watch_on_youtube]: https://www.youtube.com/watch?v=w2i-9cYxSdc&ab_channel=Remix
[submitevent-submitter]: https://developer.mozilla.org/en-US/docs/Web/API/SubmitEvent/submitter
[formdata-submitter]: https://developer.mozilla.org/en-US/docs/Web/API/FormData/FormData#submitter
[polyfill-event-submitter]: https://github.com/idea2app/event-submitter-polyfill
[polyfill-formdata-submitter]: https://github.com/jenseng/formdata-submitter-polyfill
[remix-submitter-issue]: https://github.com/remix-run/remix/issues/9704
