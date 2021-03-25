---
title: Actions and Data Updates
order: 6
---

It's time to get serious. This step in the tutorial is one of the things that makes Remix really unique so we hope you'll take the time to follow along completely.

We're going to be creating data here. If you've been doing web development for a decade or more, this is going to feel very familiar. If you're a little newer, you're going to be blown away by how easy it used to be, and how easy it is again with Remix. In summary we will:

- Post a plain HTML form to a Remix action, no JavaScript involved
- Use the special Remix `<Form>` to post with JavaScript
- Add special "loading" UI now that we have JavaScript involved with `usePendingFormSubmit`

The big takeaway here is that actions (and data mutations) in Remix are modeled as html form navigation. When submiting with JavaScript, Remix can make it faster and ensure the data updates appear on the entire page without a full page reload. Or, you can leave JavaScript at the door and use basic forms.

## Get a GitHub Personal Access Token!

This next step won't work without one. Go to your [GitHub Tokens](https://github.com/settings/tokens) page and create a new token. Make sure to check the box "Gists". That's all you'll need.

## Make a new route

Go make a file at `app/routes/gists.new.tsx` and put this in it.

```tsx
import React from "react";

export default function NewGist() {
  return (
    <>
      <h2>New Gist!</h2>
      <form method="post">
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

You've seen a `loader` already. Now you're going to create an `action`. Go back to your new route and this:

```ts [2,3-5]
import React from "react";
import type { ActionFunction } from "@remix-run/data";

export let action: ActionFunction = async ({ request }) => {
  // ...
};

export default function NewGist() {
  // ...
}
```

## Conceptual Sidebar

Quick conceptual sidebar here. Think about `useState`, what does it return?

```ts
let [state, setState] = useState(initialState);
```

It returns the value in state and a function to change it--a "reader" and a "writer". You can think about a Remix loader as `state` and a Remix action as `setState`. A reader and a writer.

Now think about `useReducer`:

```ts
let [state, dispatch] = useReducer(reducer, initialState);
```

Again we see a pair of values, one to read the state and another to update it. But this time we have a `reducer` to actually handle the state update and a function to request a change to state, `dispatch`.

Another way to think about Remix actions is that the `reducer` is your `action` and `dispatch` is your `<form>`. And the way we communicate an intent to change server state is with `<form>` (our dispatch) HTML 1.0 style and then the `action` actually deals with it (`reducer`).

```ts
// reader
export let loader = () => {};

// writer
export let action = () => {};

// intent to change state
<form method="post" />;
```

## Implement the action

Alright, back to our component, let's handle the form post and create a new gist with the GitHub API:

```ts [3,5,36]
import React from "react";
import type { ActionFunction } from "@remix-run/data";
import { redirect } from "@remix-run/data";

let action: Action = async ({ request }) => {
  // Very important or else it won't work :)
  let token = "insert your github token here";
  // in a real world scenario you'd want this token to be an enviornment
  // variable on your server, but as long as you only use it in this action, it
  // won't get included in the browser bundle.

  // get the form body out of the request using standard web APIs on the server
  let body = new URLSearchParams(await request.text());

  // pull off what we need from the form, note they are named the same thing
  // as the `<input/>` in the form.
  let fileName = body.get("fileName");
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
      "Content-Type": "application/json",
      Authorization: `token ${token}`
    }
  });

  // you always have to redirect from actions
  return redirect("/gists");
};

export default function NewGist() {
  // ... same as before
}
```

Alright, fill out your form and give it a shot! You should see your new gist on the `/gists` page!

## Upgrading to `<Form>` and pending UI states

With a regular `<form>` we're letting the browser handle the post and the pending UI (the address bar/favicon animation). Remix has a `<Form>` component and hook to go along with it to let you progressively enhance your forms. If your budget for this feature is short, just use a `<form>` and move on with your life. If you've got the time to make a fancy user experience, with Remix you don't have to rewrite your code to do the fetch with `useEffect` and manage your own state: you can just add the fancy bits with `<Form>`.

Let's update the code and add some loading indication. Note the new imports and the capital "F" `<Form>`. Now Remix is going to handle the form submit clientside with `fetch` and you get access to the serialized form data in `usePendingFormSubmit()` to build that fancy UI.

```tsx [4,11,16-22,48-67]
import React from "react";
import type { ActionFunction } from "@remix-run/data";
import { redirect } from "@remix-run/data";
import { Form, usePendingFormSubmit } from "@remix-run/react";

export let action: ActionFunction = async ({ request }) => {
  // ... same as before
};

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
        /* Note the capital Form, not form */
        <Form method="post">
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

To get the loading spinner to actually spin, put this in your css somewhere:

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

That's it! As you can see, actions + `<Form>` are really powerful. They don't require JavaScript but they also enable you to build great loading expriences at the same time.
