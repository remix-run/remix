---
title: Data Mutations with Actions
---

Data mutations in Remix are built on top of two fundamental web APIs: `<form>` and HTTP. We then use progressive enhancement to enable optimistic UI, loading indicators, and validation feedback--but the programming model is still built on HTML forms.

## Plain HTML Forms

After teaching workshops with our company <a href="https://reacttraining.com">React Training</a> for years, we've learned that a lot of newer web developers (through no fault of their own) don't actually know how `<form>` works!

Since Remix `<Form>` works identically to `<form>` (with a couple extra goodies for optimistic UI etc.), we're going to brush up on plain ol' HTML forms, so you can learn both HTML and Remix at the same time.

### HTML Form HTTP Verbs

Native forms support two HTTP verbs: `GET` and `POST`. Let's take a look at each.

### HTML Form GET

A `GET` is just a normal navigation where the data is passed in the URL search params. You use it for normal navigation that depends on user input. Aside from search pages, it's use with form is pretty rare.

Consider this form:

```html
<form method="get" action="/search">
  <label><input name="term" type="text" /></label>
  <button type="submit">Search</button>
</form>
```

When the user fills it out and clicks submit, the browser automatically serializes the from into a URL search param string and navigates to the form's `action` attribute with the query string. Let's say the user typed in "remix", the browser would navigate to `/search?term=remix`. If we changed the input to `<input name="q"/>` then the form would navigate to `/search?q=remix`.

It's the same behavior as if we had created this link:

```html
<a href="/search?term=remix">Search for "remix"</a>
```

With the unique difference that the **user** got to supply the information.

### HTML Form POST

When you want to create, delete, or update data on your website, a form post is the way to go. And we don't just mean big forms like a user profile edit page. Even "Like" buttons can be handled with a form.

Let's consider a "new project" form.

```html
<form method="post" action="/projects">
  <label><input name="name" type="text" /></label>
  <label><textarea name="description"></textarea></label>
  <button type="submit">Create</button>
</form>
```

When the user submits this form, the browser will serialize the fields into a request "body" and "POST" it to the server. This is still a normal navigation as if the user clicked a link. The difference is twofold: the user provided the data for the server and the browser sent the request as a "POST" instead of a "GET".

The data is made available to the server's request handler so you create the record. After that you return a response. In this case you'd probably redirect to the newly created project. Here's some pseudo express.js code to illustrate what the `/projects` route might look like (this is not how you do it in Remix):

```js
app.post("/projects", async (req, res) => {
  let project = await createProject(req.body);
  res.redirect(`/projects/${project.id}`);
});
```

The browser started at `/projects/new`, then posted to `/projects` with the form data in the request, then the server redirect the browser to `/projects/123`. The while the browser goes into it's normal "loading" state. The address progress bar fills up, the favicon turns into a spinner, etc. It's actually a solid user experience.

If you're newer to web development, you may not have ever used a form this way. Lots of folks have always done `onSubmit={() => { fetch(...) }}` and dealt with it all in JavaScript. You're going to be delighted when you see just how easy mutations can be when you just use what browsers (and Remix) have built in!

## A mutation in Remix from start to finish

We're going to build a mutation from start to finish with:

1. JavaScript optional
2. Validation
3. Error handling
4. Progressively enhanced loading indicators
5. Progressively enhanced error display

You use the Remix `<Form>` component for data mutations the same way you use HTML forms. The difference is now you get access to pending form state to build a nicer user experience: like contextual loading indicators and "optimistic UI". Whether you use `<form>` or `<Form>` though, you write the very same code. You can start with a `<form>` and then graduate it to `<Form>` without changing anything. After that, add in the special loading indicators and optimistic UI. However, if you're not feeling up to it, or deadlines are tight, just us a `<form>` and let the browser handle the user feedback! Remix `<Form>` is the realization of "progressive enhancement" for mutations.

## Building the form

Let's start with our project form from earlier but make it usable:

Let's say you've got the route `app/routes/projects/new.js` with this form in it:

```tsx
export default function NewProject() {
  return (
    <form method="post" action="/projects/new">
      <p>
        <label>
          Name: <input name="name" type="text" />
        </label>
      </p>
      <p>
        <label>
          Description:
          <br />
          <textarea name="description" />
        </label>
      </p>
      <p>
        <button type="submit">Create</button>
      </p>
    </form>
  );
}
```

Now add the route action. Any form submits that aren't "get" submits will call your data "action", any "get" requests (links, and the rare `<form method="get">`) will be handled by your "loader".

```ts
import type { Action } from "remix";
import { redirect } from "remix";

// Note the "action" export name, this will handle our form POST
export let action: Action = async ({ request }) => {
  let newProject = new URLSearchParams(await request.text());
  let project = await createProject(Object.fromEntries(newProject));

  return redirect(`/projects/${project.id}`);
};

export default function NewProject() {
  // ... same as before
}
```

And that's it! Assuming `createProject` does what we want it to, that's the core functionality.

## Always Return a Redirect from Actions

Remix requires you to return a `redirect` from actions. We're fixing a longstanding issue with web development that browsers can't fix on their own. You've seen the alerts on websites like:

> Don't click the back button or you will be charged twice!

Or

> Please do not click back in your browser or you will book another flight!

The right thing to do is redirect from the "POST" so that when the user clicks back it goes to the page with the form, not the action that charges their credit card! Because browsers don't own the server, their only choice when the user clicks back is to repost the form.

Remix forces you to redirect from actions so that this bug never makes it into your app.

## Form Validation

It's common to validate forms both clientside and serverside. It's also (unfortunately) common to only validate clientside, which leads to various issues with your data that we don't have time to get into right now. Point is, if your validating in only one place, do it on the server.

We know, we know, you want to animate in nice validation errors and stuff. We'll get to that. But right now we're just building a basic HTML form and user flow. We'll keep it simple first, then make it fancy.

Back in our data action, maybe we have an API that returns validation errors like this.

```js
let [errors, project] = await createProject(newProject);
```

If there are validation errors, we want to go back to the form and display them. If enabled, Remix sends a `session` object to your loaders and actions, we can use that to store the form validation errors.

```js
import type { Action, loader } from "remix";
import { redirect } from "remix";

export let action: Action = async ({ request, session }) => {
  let newProject = new URLSearchParams(await request.text());
  let [errors, project] = await createProject(Object.fromEntries(newProject));

  if (errors) {
    // session.flash puts a value in the session that can only be read on the
    // very next request. Here we put both the errors and the newProject values
    // to be read later in the component
    session.flash("failedSubmit", { errors, values: newProject });
    return redirect(`/projects`);
  }

  return redirect(`/projects/${project.id}`);
};

export let loader: Loader = () => {
  // we'll be back here in a minute
};
```

After we redirect from the validation errors, we end up back in this same data module, only this time it's a "GET", so our `exports.loader` will get called. Let's read the session data and send it to the form:

```js
export let loader: Loader = ({ request, session }) => {
  return session.get("failedSubmit") || null;
};
```

Now we can display the validation errors and the previous values in our UI with `useRouteData()`.

Notice how we add `defaultValue` to all of our inputs. Remember, this is still a `<form>`, so it's just normal browser/server stuff happening. We're getting the values back from the server so the user doesn't have to re-type what they had.

```tsx
export default function NewProject() {
  let failedSubmit = useRouteData();

  return (
    <form method="post" action="/projects/new">
      <p>
        <label>
          Name:{" "}
          <input
            name="name"
            type="text"
            defaultValue={failedSubmit ? failedSubmit.values.name : undefined}
          />
        </label>
      </p>
      {failedSubmit && failedSubmit.errors.name && (
        <p style={{ color: "red" }}>{failedSubmit.errors.name}</p>
      )}

      <p>
        <label>
          Description:
          <br />
          <textarea
            name="description"
            defaultValue={
              failedSubmit ? failedSubmit.values.description : undefined
            }
          />
        </label>
      </p>
      {failedSubmit && failedSubmit.errors.description && (
        <p style={{ color: "red" }}>{failedSubmit.errors.description}</p>
      )}

      <p>
        <button type="submit">Create</button>
      </p>
    </form>
  );
}
```

## Graduate to `<Form>` and add pending UI

Let's use progressive enhancement to make this UX a bit more fancy. By changing it from `<form>` to `<Form>`, Remix will emulate the browser behavior with `fetch` and then give you access to the pending form information to build pending UI.

```tsx
import { Form, useRouteData } from "remix";

export default function NewProject() {
  let failedSubmit = useRouteData();

  return (
    // note the capital "F" <Form> now
    <Form method="post" action="/projects/new">
      {/* ... */}
    </Form>
  );
}
```

HOLD UP! If all you do is change your `<form>` to `<Form>`, you made the UX a little worse. If you don't have the time or drive to do the rest of the job here, leave it as `<form>` so that the browser handles pending UI state (spinner in the favicon of the tab, progress bar in the address bar, etc.) If you simply use `<Form>` without implementing pending UI, the user will have no idea anything is happening when they submit a form.

Now let's add some pending UI so the user has a clue something happened when they submit. There's a hook called `usePendingFormSubmit`. When there is a pending form submit, Remix will give you the serialized version of the form as a <a href="https://developer.mozilla.org/en-US/docs/Web/API/FormData">`FormData`</a> object. You'll be most interested in the <a href="https://developer.mozilla.org/en-US/docs/Web/API/FormData/get">`formData.get()`</a> method..

```tsx
import { Form, useRouteData, usePendingFormSubmit } from "remix";

export let loader: Loader = () => {
  // same as before
};

export let action: Action = () => {
  // same as before
};

export default function NewProject() {
  let failedSubmit = useRouteData();

  // when the form is being processed on the server, this returns the same data
  // that was sent. When the submit is complete, this will return `undefined`.
  let pendingForm = usePendingFormSubmit();

  return (
    <Form method="post" action="/projects">
      {/* wrap all our elements in a fieldset
          so we can disable them all at once */}
      <fieldset disabled={!!pendingForm}>
        <p>
          <label>
            Name:{" "}
            <input
              name="name"
              type="text"
              defaultValue={failedSubmit ? failedSubmit.values.name : undefined}
            />
          </label>
        </p>
        {failedSubmit && failedSubmit.errors.name && (
          <p style={{ color: "red" }}>{failedSubmit.errors.name}</p>
        )}

        <p>
          <label>
            Description:
            <br />
            <textarea
              name="description"
              defaultValue={
                failedSubmit ? failedSubmit.values.description : undefined
              }
            />
          </label>
        </p>
        {failedSubmit && failedSubmit.errors.description && (
          <p style={{ color: "red" }}>{failedSubmit.errors.description}</p>
        )}

        <p>
          <button type="submit">
            {/* and a little bit of pending UI */}
            {pendingForm ? "Creating..." : "Create"}
          </button>
        </p>
      </fieldset>
    </Form>
  );
}
```

Pretty slick! Now when the user clicks submit, the inputs go disabled, and the submit button's text changes. The whole operation should be faster now too since there's just one network request happening instead of a full page reload (which involves potentially more network requests, reading assets from the browser cache, parsing JavaScript, parsing CSS, etc.).

We didn't do much with `pendingForm`, on this page, but you can ask for values from the object while it's pending like `pendingForm.data.get("name")` or `pendingForm.data.get("description")`. You can also see the method used with `pendingForm.method`.

## Animating in the Validation Errors

Now that we're using JavaScript to submit this page, our validation errors can be animated in because the page is stateful. First we'll make a fancy component that animates its height and opacity:

```tsx
function ValidationMessage({ errorMessage, isPending }) {
  let [show, setShow] = React.useState(!!error);

  React.useEffect(() => {
    requestAnimationFrame(() => {
      let hasError = !!errorMessage;
      setShow(hasError && !isPending);
    });
  }, [error, isPending]);

  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        height: show ? "1em" : 0,
        color: "red",
        transition: "all 300ms ease-in-out"
      }}
    >
      {errorMessage}
    </div>
  );
}
```

Now we can wrap our old error messages in this new fancy component, and even turn the borders of our fields red that have errors:

```tsx
function NewProject() {
  let failedSubmit = useRouteData();
  let pendingForm = usePendingFormSubmit();

  return (
    <form method="post" action="/projects">
      <fieldset disabled={!!pendingForm}>
        <p>
          <label>
            Name:{" "}
            <input
              name="name"
              type="text"
              defaultValue={failedSubmit ? failedSubmit.values.name : undefined}
              style={{
                borderColor:
                  failedSubmit && failedSubmit.errors.name ? "red" : ""
              }}
            />
          </label>
        </p>
        <ValidationMessage
          isPending={!!pendingForm}
          errorMessage={failedSubmit && failedSubmit.errors.name}
        />

        <p>
          <label>
            Description:
            <br />
            <textarea
              name="description"
              defaultValue={
                failedSubmit ? failedSubmit.values.description : undefined
              }
              style={{
                borderColor:
                  failedSubmit && failedSubmit.errors.description ? "red" : ""
              }}
            />
          </label>
        </p>
        <ValidationMessage
          isPending={!!pendingForm}
          errorMessage={failedSubmit && failedSubmit.errors.description}
        />

        <p>
          <button type="submit">
            {pendingForm ? "Creating..." : "Create"}
          </button>
        </p>
      </fieldset>
    </form>
  );
}
```

Boom! Fancy UI!

## Optimistic UI, Pending Delete Indication, and more

Something the previous example doesn't illustrate well is "optimistic UI". The `usePendingFormSubmit().data` object, as mentioned before, contains the values of the form that's being submit. You can use that to build an "optimistic UI" while the record is being created on the server.

Consider a little todo list. You can optimistically show the new todo before it's even saved to the database.

Even single buttons that perform data mutations can be modeled as `<Form>` and data actions. For example, "Like" and "Delete" buttons.

Check out this sample Todo app component that uses all the tricks we've just learned about.

Here's the component route:

```tsx
import type { Action, Loader } from "remix";
import { json, redirect } from "remix";
import { readTodos, createTodo, deleteTodo } from "../models/todo";

export let loader: Loader = = async ({ request, session }) => {
  let todos = await readTodos();
  let error = session.get("error") || null;
  return json({ todos, error });
};

export let action: Action = async ({ request }) => {
  let body = new URLSearchParams(await request.text());

  switch (request.method) {
    case "post": {
      let [_, error] = await createTodo(body.name);
      if (error) {
        session.flash("error", error);
      }
      return redirect("/todos");
    }
    case "delete": {
      await deleteTodo(body.id);
      return redirect("/todos");
    }
    default: {
      throw new Error(`Unknown method! ${request.method}`);
    }
  }
};

export default function Todos() {
  let { todos } = useRouteData();
  let pendingForm = usePendingFormSubmit();

  let state = !pendingForm
    ? "idle"
    : pendingForm.method === "post"
    ? "creating"
    : pendingForm.method === "delete"
    ? "deleting"
    : throw new Error("unexpected pending form method");

  let showErrorTodo = state === "idle" && error;

  let pendingTodo = pendingForm
    ? Object.fromEntries(pendingForm.data)
    : undefined;

  return (
    <div>
      <h1>Todos</h1>
      <Form method="post">
        <input type="text" name="name" />
      </Form>

      <ul>
        {showErrorTodo && (
          <li>
            <span style={{ opacity: 0.5 }}>{error.name}</span>{" "}
            <span style={{ color: "red" }}>{error.message}</span>
          </li>
        )}

        {/* Optimistic UI */}
        {state === "creating" && (
          <li style={{ opacity: 0.5 }}>{pendingTodo.name}</li>
        )}

        {todos.map((todo: Todo) => (
          <li
            key={todo.id}
            style={{
              opacity:
                // pending delete indicator
                state === "deleting" && pendingTodo.id === todo.id ? 0.25 : 1,
            }}
          >
            {todo.name}{" "}
            <DeleteButton
              id={todo.id}
              disabled={state === "deleting" || state === "creating"}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Visually it's just a button, but it's a form since it's a mutation.
function DeleteButton({ id, disabled, ...props }) {
  return (
    <Form replace method="delete" style={{ display: "inline" }}>
      {/* hidden inputs send the action information we need to delete */}
      <input type="hidden" name="id" value={id} />
      <button disabled={disabled} {...props}>
        <TrashIcon />
      </button>
    </Form>
  );
}
```

## Review

First we built the project form without JavaScript in mind. A simple form, posting to a data action.

Once that worked, we use JavaScript to submit the form by changing `<form>` to `<Form>`.

Now that there was a stateful page with React, we added loading indicators and animation for the validation errors.

From your components perspective, all that happend was the `usePendingFormSubmit` hook caused a state update when the form was submit, and then another state update when the data came back in `useRouteData()` and `usePendingFormSubmit()` no longer returned anything. Of course, a lot more happened inside of Remix, but as far as your component is concerned that's it. Just a couple state updates. This makes it really easy to dress up any user flow involving mutations.

## See also

- [Form](../api/react#form)
- [usePendingLocation](../api/react#usependinglocation)
- [Sessions](../guides/sessions)
- [Actions](../api/app/route-module#action)
- [Loaders](../api/app/route-module#loader)
