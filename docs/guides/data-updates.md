---
title: Data Updates
---

# Data Updates

Data updates (some people call these mutations) in Remix are built on top of two fundamental web APIs: `<form>` and HTTP. We then use progressive enhancement to enable optimistic UI, loading indicators, and validation feedback--but the programming model is still built on HTML forms.

When the user submits a form, Remix will:

1. Call the action for the form
2. Load or reload all of the data for all of the routes on the page

This removes any need for global state management in your app.

There are a few ways to call an action and get the routes to reload:

- [`<Form>`](../../api/remix/#form)
- [`useSubmit()`](../../api/remix/#usesubmit)
- [`useFetcher()`](../../api/remix/#usefetcher)

This guide only covers `<Form>`. We suggest you read the docs for the other two after this guide to get a sense of how to use them. Most of this guide applies to `useSubmit` but `useFetcher` is a bit different because unlike the native browser form behavior, it calls actions without changing the URL (but also doesn't work without JavaScript by default).

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

```tsx
import type { ActionFunction } from "remix";
import { redirect } from "remix";

// Note the "action" export name, this will handle our form POST
export let action: ActionFunction = async ({ request }) => {
  let newProject = new URLSearchParams(
    await request.text()
  );

  let project = await createProject(
    Object.fromEntries(newProject)
  );

  return redirect(`/projects/${project.id}`);
};

export default function NewProject() {
  // ... same as before
}
```

And that's it! Assuming `createProject` does what we want it to, that's the core functionality.

## Form Validation

It's common to validate forms both clientside and serverside. It's also (unfortunately) common to only validate clientside, which leads to various issues with your data that we don't have time to get into right now. Point is, if your validating in only one place, do it on the server.

We know, we know, you want to animate in nice validation errors and stuff. We'll get to that. But right now we're just building a basic HTML form and user flow. We'll keep it simple first, then make it fancy.

Back in our action, maybe we have an API that returns validation errors like this.

```tsx
let [errors, project] = await createProject(newProject);
```

If there are validation errors, we want to go back to the form and display them. If enabled, Remix sends a `session` object to your loaders and actions, we can use that to store the form validation errors.

```tsx [17-18]
import type { ActionFunction, LoaderFunction } from "remix";
import { redirect } from "remix";

export let action: ActionFunction = async ({
  request,
  session
}) => {
  let newProject = new URLSearchParams(
    await request.text()
  );

  let [errors, project] = await createProject(
    Object.fromEntries(newProject)
  );

  if (errors) {
    // return the errors from the action
    return { errors, values: newProject };
  }

  return redirect(`/projects/${project.id}`);
};
```

Just like `useLoaderData` returns the values from the `loader`, `useActionData` will return the data from the action. It will only be there if the navigation was a form submission, so you always have to check if you've got it or not.

```tsx [1, 14-17, 23-27, 35-38, 44-48]
import { redirect, useActionData } from "remix";

export default function NewProject() {
  let actionData = useActionData();

  return (
    <form method="post" action="/projects/new">
      <p>
        <label>
          Name:{" "}
          <input
            name="name"
            type="text"
            defaultValue={
              actionData
                ? actionData.values.name
                : undefined
            }
          />
        </label>
      </p>

      {actionData && actionData.errors.name && (
        <p style={{ color: "red" }}>
          {actionData.errors.name}
        </p>
      )}

      <p>
        <label>
          Description:
          <br />
          <textarea
            name="description"
            defaultValue={
              actionData
                ? actionData.values.description
                : undefined
            }
          />
        </label>
      </p>

      {actionData && actionData.errors.description && (
        <p style={{ color: "red" }}>
          {actionData.errors.description}
        </p>
      )}

      <p>
        <button type="submit">Create</button>
      </p>
    </form>
  );
}
```

Notice how we add `defaultValue` to all of our inputs. Remember, this is still a `<form>`, so it's just normal browser/server stuff happening. We're getting the values back from the server so the user doesn't have to re-type what they had.

## Graduate to `<Form>` and add pending UI

Let's use progressive enhancement to make this UX a bit more fancy. By changing it from `<form>` to `<Form>`, Remix will emulate the browser behavior with `fetch` and then give you access to the pending form information to build pending UI.

Also, with `<Form>`, we can leave off the action and it will post to the route it's rendered in.

```tsx [1, 10]
import { redirect, useActionData, Form } from "remix";

// ...

export default function NewProject() {
  let actionData = useActionData();

  return (
    // note the capital "F" <Form> now
    <Form method="post">{/* ... */}</Form>
  );
}
```

<docs-error>HOLD UP! If all you do is change your form to Form, you made the UX a little worse!</docs-error>

If you don't have the time or drive to do the rest of the job here, use `<Form reloadDocument>`. This lets the browser continue to handle the pending UI state (spinner in the favicon of the tab, progress bar in the address bar, etc.) If you simply use `<Form>` without implementing pending UI, the user will have no idea anything is happening when they submit a form.

<docs-info>We recommend always using capital-F Form, and if you want to let the browser handle the pending UI, use the <code>&lt;Form reloadDocument&gt;</code> prop.</docs-info>

Now let's add some pending UI so the user has a clue something happened when they submit. There's a hook called `useTransition`. When there is a pending form submission, Remix will give you the serialized version of the form as a <a href="https://developer.mozilla.org/en-US/docs/Web/API/FormData">`FormData`</a> object. You'll be most interested in the <a href="https://developer.mozilla.org/en-US/docs/Web/API/FormData/get">`formData.get()`</a> method..

```tsx [5, 13, 19, 65-67]
import {
  redirect,
  useActionData,
  Form,
  useTransition
} from "remix";

// ...

export default function NewProject() {
  // when the form is being processed on the server, this returns different
  // transition states to help us build pending and optimistic UI.
  let transition = useTransition();
  let actionData = useActionData();

  return (
    <Form method="post">
      <fieldset
        disabled={transition.state === "submitting"}
      >
        <p>
          <label>
            Name:{" "}
            <input
              name="name"
              type="text"
              defaultValue={
                actionData
                  ? actionData.values.name
                  : undefined
              }
            />
          </label>
        </p>

        {actionData && actionData.errors.name && (
          <p style={{ color: "red" }}>
            {actionData.errors.name}
          </p>
        )}

        <p>
          <label>
            Description:
            <br />
            <textarea
              name="description"
              defaultValue={
                actionData
                  ? actionData.values.description
                  : undefined
              }
            />
          </label>
        </p>

        {actionData && actionData.errors.description && (
          <p style={{ color: "red" }}>
            {actionData.errors.description}
          </p>
        )}

        <p>
          <button type="submit">
            {transition.state === "submitting"
              ? "Creating..."
              : "Create"}
          </button>
        </p>
      </fieldset>
    </Form>
  );
}
```

Pretty slick! Now when the user clicks "Create", the inputs go disabled, and the submit button's text changes. The whole operation should be faster now too since there's just one network request happening instead of a full page reload (which involves potentially more network requests, reading assets from the browser cache, parsing JavaScript, parsing CSS, etc.).

We didn't do much with `transition`, on this page, but you can ask for values from the object while it's pending like `transition.submission.formData.data.get("name")` or `transition.submission.formData.get("description")`.

## Animating in the Validation Errors

Now that we're using JavaScript to submit this page, our validation errors can be animated in because the page is stateful. First we'll make a fancy component that animates height and opacity:

```tsx
function ValidationMessage({ errorMessage, isPending }) {
  let [show, setShow] = useState(!!error);

  useEffect(() => {
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

```tsx [21-24, 31-34, 48-51, 57-60]
export default function NewProject() {
  let transition = useTransition();
  let actionData = useActionData();

  return (
    <Form method="post">
      <fieldset
        disabled={transition.state === "submitting"}
      >
        <p>
          <label>
            Name:{" "}
            <input
              name="name"
              type="text"
              defaultValue={
                actionData
                  ? actionData.values.name
                  : undefined
              }
              style={{
                borderColor: actionData?.errors.name
                  ? "red"
                  : ""
              }}
            />
          </label>
        </p>

        {actionData && actionData.errors.name && (
          <ValidationMessage
            isPending={transition.state === "submitting"}
            errorMessage={actionData?.errors?.name}
          />
        )}

        <p>
          <label>
            Description:
            <br />
            <textarea
              name="description"
              defaultValue={
                actionData
                  ? actionData.values.description
                  : undefined
              }
              style={{
                borderColor: actionData?.errors.description
                  ? "red"
                  : ""
              }}
            />
          </label>
        </p>

        <ValidationMessage
          isPending={transition.state === "submitting"}
          errorMessage={actionData?.errors.description}
        />

        <p>
          <button type="submit">
            {transition.state === "submitting"
              ? "Creating..."
              : "Create"}
          </button>
        </p>
      </fieldset>
    </Form>
  );
}
```

Boom! Fancy UI with the simple model of mutations-as-navigation.

## Review

First we built the project form without JavaScript in mind. A simple form, posting to a data action.

Once that worked, we use JavaScript to submit the form by changing `<form>` to `<Form>`.

Now that there was a stateful page with React, we added loading indicators and animation for the validation errors.

From your components perspective, all that happend was the `useTransition` hook caused a state update when the form was submitted, and then another state update when the data came back. Of course, a lot more happened inside of Remix, but as far as your component is concerned, that's it. Just a couple state updates. This makes it really easy to dress up any user flow.

## See also

- [Form](../api/react#form)
- [useTransition](../api/react#usetransition)
- [Actions](../api/app/route-module#action)
- [Loaders](../api/app/route-module#loader)
- [`useSubmit()`](../../api/remix/#usesubmit)
- [`useFetcher()`](../../api/remix/#usefetcher)
