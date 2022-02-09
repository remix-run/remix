---
title: FAQs
description: Frequently Asked Questions about Remix
---

# Frequently Asked Questions

## How can I have a parent route loader validate the user and protect all child routes?

You can't 😅. During a client side transition, to make your app as speedy as possible, Remix will call all of your loaders _in parallel_, in separate fetch requests. Each one of them needs to have it's own authentication check.

This is probably not different than what you were doing before Remix, it might just be more obvious now. Outside of Remix, when you make multiple fetches to your "API Routes", each of those endpoints needs to validate the user session. In other words, Remix route loaders are their own "API Route" and must be treated as such.

We recommend you create a function that validates the user session that can be added to any routes that require it.

```tsx filename=app/session.js lines=[9-22]
import {
  createCookieSessionStorage,
  redirect
} from "remix";

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
    throw new redirect("/login");
  }

  return session;
}
```

And now in any loader or action that requires a user session, you can call the function.

```tsx filename=app/routes/projects.jsx lines=[3]
export async function loader({ request }) {
  // if the user isn't authenticated, this will redirect to login
  const session = await requireUserSession(request);

  // otherwise the code continues to execute
  const projects = await fakeDb.projects.scan({
    userId: session.get("userId")
  });
  return projects;
}
```

Even if you don't need the session information, the function will still protect the route:

```js
export async function loader({ request }) {
  await requireUserSession(request);
  // continue
}
```

## How do I handle multiple forms in one route?

[Watch on YouTube](https://www.youtube.com/watch?v=w2i-9cYxSdc&ab_channel=Remix)

In HTML, forms can post to any URL with the action prop and the app will navigate there:

```jsx
<Form action="/some/where" />
```

In Remix the action defaults to the route that the form is rendered in, making it easy to co-locate the UI and the server code that handles it. Developers often wonder how you can handle multiple actions in this scenario. You have two choices:

1. Send a form field to determine the action you want to take
2. Post to a different route and redirect back to the original

We find option (1) to be the simplest because you don't have to mess around with sessions to get validation errors back to the UI.

HTML buttons can send a value, so it's the easiest way to implement this:

```jsx filename=app/routes/projects/$id.jsx lines=[3-4,33,39]
export async function action({ request }) {
  let formData = await request.formData();
  let action = formData.get("_action");
  switch (action) {
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
  let project = useLoaderData();
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
        <button type="submit" name="_action" value="create">
          Update
        </button>
      </Form>

      <Form method="post">
        <button type="submit" name="_action" value="delete">
          Delete
        </button>
      </Form>
    </>
  );
}
```

You can also use a hidden input field:

```jsx lines=[2]
<Form method="post">
  <input type="hidden" name="_action" value="create" />
  <button type="submit">Create</button>
</Form>
```

<docs-error>Do not use `action` as your field name!</docs-error>

You may wonder why we used `<button name="_action">` instead of `<button name="action">`. You can use whatever you want, but just not `"action"`!

Without getting into browser decisions decades ago, form elements have the `form.action` property in the DOM to know where to post to. In our case: `form._action`. If you use `action`, there's a conflict and the submission will fail.

## How can I have structured data in a form?

If you're used to doing a fetches with a content type of `application/json`, you may wonder how forms fit into this. [`FormData`][form-data] is a bit different than JSON.

- It can't have nested data, it's just "key value".
- It _can_ have multiple entries on one key, unlike JSON.

If you're wanting to send structured data simply to post arrays, you can use the same key on multiple inputs:

```jsx
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

Each checkbox has the name: "category". Since `FormData` can have multiple values on the same key, you don't need JSON for this. In your, action you can access them all with `formData.getAll()`

```tsx
export function action({ request }) {
  const formData = await request.formData();
  let categories = formData.getAll("category");
  // ["comedy", "music"]
}
```

Using the same input name and `formData.getAll()` covers most cases for wanting to submit structured data in your forms.

If you still want to submit nested structures as well, you can use non-standard form field naming conventions and the [`query-string`][query-string] package from npm:

```tsx
// arrays with []
<input name="category[]" value="comedy" />
<input name="category[]" value="comedy" />
// nested structures parentKey[childKey]
<input name="user[name]" value="Ryan" />
```

And then in your action:

```tsx
import queryString from "query-string";

// in your action:
export function action({ request }) {
  // use `request.text()`, not `request.formData` to get the form data as a url
  // encoded form query string
  let formQueryString = await request.text();

  // parse it into an object
  let obj = queryString.parse(formQueryString);
}
```

Some folks even dump their JSON into a hidden field, we don't know if we recommend this approach but it certainly works!

```tsx
<input
  type="hidden"
  name="json"
  value={JSON.stringify(obj)}
/>
```

And then parse it in the action:

```tsx
export function action({ request }) {
  let formData = await request.formData();
  let obj = JSON.parse(formData.get("json"));
}
```

Again, often `formData.getAll()` is all you need, we encourage you to give it a shot!

[form-data]: https://developer.mozilla.org/en-US/docs/Web/API/FormData
[query-string]: https://www.npmjs.com/package/query-string
