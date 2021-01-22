---
title: Data Mutations
---

It's time to get serious. We're going to be creating data here. If you've been doing web development for a decade or more, this is going to feel very familiar, if not, you're going to be blown away by how easy it used to be, and how easy it is again with Remix.

## Get a GitHub Peresonal Access Token!

This won't work without one. So go to your [GitHub Tokens](https://github.com/settings/tokens) page and create a new token. Make sure to check the box "Gists". That's all you'll need.

## Make a new route

Go make a file at `app/routes/gists.new.tsx` and put this in it.

```tsx
import React from "react";

export default function NewGist() {
  return (
    <>
      <h2>New Gist!</h2>
      <form method="post" action="/gists">
        <p>
          <label>
            Gist file name:
            <br />
            <input required type="text" name="fileName" />
          </label>
        </p>
        <p>
          <label>
            Content:
            <br />
            <textarea required rows={10} name="content" />
          </label>
        </p>
        <p>
          <button type="submit">Create Gist</button>
        </p>
      </form>
    </>
  );
}
```

Notice we're using a plain HTML `<form/>` with an action that points to our `/gists` route, and then we name the inputs. When you submit this form, the browser will post to the gists data module--no JavaScript required. We're going to make this work with a plain `<form>` first, and then we'll upgrade it to a Remix `<Form>` to show how to progressively enhance the form when you have the budget to create a really nice UX with JavaScript.

Now let's go create an "action" to handle this form.

## Data Actions

You've seen a `loader`. Now you're going to create an `action`. Every data module can export a "reader" and a "writer". Just like React, you have `[state, setState] = React.useState()`, or `[state, dispatch] = React.useReducer()`. Readers and writers. Data and mutations. _Loaders and Actions_.

Open up your data module at `data/gists.ts` and add an action:

```ts
// add the Action type
import type { Loader, Action } from "@remix-run/data";

// add a new import here
import { redirect } from "@remix-run/data";

// Very important or else it won't work :)
let token = "insert your github token here";

// we already had this
let loader: Loader = () => {
  return fetch("https://api.github.com/gists");
};

// The new stuff!
let action: Action = async ({ request }) => {
  // When the form request posts here, this helper turns it into a
  // URLSearchParams
  let body = new URLSearchParams(await request.text());

  // pull off what we need from the form, note they are named the same thing
  // as the `<input/>` in the form.
  let fileName = body.get("fileName") as string;
  let content = body.get("content");

  // Hit the GitHub API to create a gist
  await fetch("https://api.github.com/gists", {
    method: "post",
    body: JSON.stringify({
      description: "Created from Remix Form!",
      public: true,
      files: { [fileName]: { content } }
    }),
    headers: {
      "content-type": "application/json",
      authorization: `token ${token}`
    }
  });

  // you always have to redirect from actions
  return redirect("/gists");
};

export { action, loader };
```

Alright, fill out your form and give it a shot! You should see your new gist on the `/gists` page!

## Upgrading to `<Form>` and pending UI states

With a regular `<form>` we're letting the browser handle the post and the pending UI (the address bar/favicon animation). Remix has a `<Form>` component and hook to go along with it to let you progressively enhance your forms. If your budget for this feature is short, just use a `<form>` and move on with your life. If you've got the time to make a fancy user experience, you don't have to rewrite your code with Remix, you can just add the fancy bits with `<Form>`.

Let's update the code and add some loading indication. Note the new imports and the capital "F" `<Form>`. Now Remix is going to handle the form submit clientside with `fetch` and you get access to the serialized form data in `usePendingFormSubmit()` to build that fancy UI.

```tsx
import React from "react";
import { Form, usePendingFormSubmit } from "@remix-run/react";

export default function NewGist() {
  let pendingForm = usePendingFormSubmit();

  return (
    <>
      <h2>New Gist!</h2>
      {pendingForm ? (
        <div>
          <p>
            <Loading /> Creating gist: {pendingForm.data.get("fileName")}
          </p>
        </div>
      ) : (
        <Form method="post" action="/gists">
          <p>
            <label>
              Gist file name:
              <br />
              <input required type="text" name="fileName" />
            </label>
          </p>
          <p>
            <label>
              Content:
              <br />
              <textarea required rows={10} name="content" />
            </label>
          </p>
          <p>
            <button type="submit">Create Gist</button>
          </p>
        </Form>
      )}
    </>
  );
}

function Loading() {
  return (
    <svg
      className="spin"
      style={{ height: "1rem" }}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
```

To get the loading spinner to work, make a file at `app/routes/gists.new.css` and put this in it:

```css
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.spin {
  animation: spin 1s infinite;
}
```

That's it! As you can see, actions + `<Form>` are really powerful and really easy. And while it's really cool that it works without JavaScript, the point is not to accomodate "users without JavaScript". The point is that this programming model is very simple. Usually you have a whole bunch of other code to write to handle submiting a form with loading states and optimistic UI, but in remix it's simply using a capital F `<Form>` and a hook for the pending information, everythign else is the same.

---

[Next up: Deploying](/dashboard/docs/tutorial/deploying)
