---
title: Data Writes
---

# Data Writes

Data writes (some people call these mutations) in Remix are built on top of two fundamental web APIs: `<form>` and HTTP. We then use progressive enhancement to enable optimistic UI, loading indicators, and validation feedback--but the programming model is still built on HTML forms.

When the user submits a form, Remix will:

1. Call the action for the form
2. Reload all of the data for all of the routes on the page

Many times people reach for global state management libraries in React like redux, data libs like apollo, and fetch wrappers like React Query in order to help manage getting server state into your components and keeping the UI in sync with it when the user changes it. Remix's HTML based API replaces the majority of use cases for these tools. Remix knows how to load the data as well as how to revalidate it after it changes when you use standard HTML APIs.

There are a few ways to call an action and get the routes to revalidate:

- [`<Form>`](../api/remix#form)
- [`useSubmit()`](../api/remix#usesubmit)
- [`useFetcher()`](../api/remix#usefetcher)

This guide only covers `<Form>`. We suggest you read the docs for the other two after this guide to get a sense of how to use them. Most of this guide applies to `useSubmit` but `useFetcher` is a bit different.

## Plain HTML Forms

After teaching workshops with our company <a href="https://reacttraining.com">React Training</a> for years, we've learned that a lot of newer web developers (through no fault of their own) don't actually know how `<form>` works!

Since Remix `<Form>` works identically to `<form>` (with a couple extra goodies for optimistic UI etc.), we're going to brush up on plain ol' HTML forms, so you can learn both HTML and Remix at the same time.

### HTML Form HTTP Verbs

Native forms support two HTTP verbs: `GET` and `POST`. Remix uses these verbs to understand your intent. If it's a get, Remix will figure out what parts of the page are changing and only fetch the data for the changing layouts, and use the cached data for the layouts that don't change. When it's a POST, Remix will reload all data to ensure it captures the update from the server. Let's take a look at both.

### HTML Form GET

A `GET` is just a normal navigation where the form data is passed in the URL search params. You use it for normal navigation, just like `<a>` excpect the user gets to provide the data in the search params through the form. Aside from search pages, it's use with `<form>` is pretty rare.

Consider this form:

```html
<form method="get" action="/search">
  <label>Search <input name="term" type="text" /></label>
  <button type="submit">Search</button>
</form>
```

When the user fills it out and clicks submit, the browser automatically serializes the form values into a URL search param string and navigates to the form's `action` with the query string appended. Let's say the user typed in "remix". The browser would navigate to `/search?term=remix`. If we changed the input to `<input name="q"/>` then the form would navigate to `/search?q=remix`.

It's the same behavior as if we had created this link:

```html
<a href="/search?term=remix">Search for "remix"</a>
```

With the unique difference that the **user** got to supply the information.

If you have more fields, the browser will add them:

```html
<form method="get" action="/search">
  <fieldset>
    <legend>Brand</legend>
    <label>
      <input name="brand" value="nike" type="checkbox" />
      Nike
    </label>
    <label>
      <input name="brand" value="reebok" type="checkbox" />
      Reebok
    </label>
    <label>
      <input name="color" value="white" type="checkbox" />
      White
    </label>
    <label>
      <input name="color" value="black" type="checkbox" />
      White
    </label>
    <button type="submit">Search</button>
  </fieldset>
</form>
```

Depending on which checkboxes the uses clicks, the browser will navigate to URLs like:

```
/search?brand=nike&color=black
/search?brand=nike&brand=reebok&color=white
```

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

When the user submits this form, the browser will serialize the fields into a request "body" (instead of URL search params) and "POST" it to the server. This is still a normal navigation as if the user clicked a link. The difference is twofold: the user provided the data for the server and the browser sent the request as a "POST" instead of a "GET".

The data is made available to the server's request handler so you can create the record. After that, you return a response. In this case, you'd probably redirect to the newly created project. A remix action would look something like this:

```js filename=app/routes/projects
export function action({ request }) {
  let body = await request.formData();
  let project = await createProject(body);
  redirect(`/projects/${project.id}`);
}
```

The browser started at `/projects/new`, then posted to `/projects` with the form data in the request, then the server redirected the browser to `/projects/123`. While this is all happening, the browser goes into it's normal "loading" state: the address progress bar fills up, the favicon turns into a spinner, etc. It's actually a decent user experience.

If you're newer to web development, you may not have ever used a form this way. Lots of folks have always done:

```js
<form
  onSubmit={event => {
    event.preventDefault();
    // good luck!
  }}
/>
```

If this is you, you're going to be delighted when you see just how easy mutations can be when you just use what browsers (and Remix) have built in!

## Remix Mutation, Start to Finish

We're going to build a mutation from start to finish with:

1. JavaScript optional
2. Validation
3. Error handling
4. Progressively enhanced loading indicators
5. Progressively enhanced error display

You use the Remix `<Form>` component for data mutations the same way you use HTML forms. The difference is now you get access to pending form state to build a nicer user experience: like contextual loading indicators and "optimistic UI".

Whether you use `<form>` or `<Form>` though, you write the very same code. You can start with a `<form>` and then graduate it to `<Form>` without changing anything. After that, add in the special loading indicators and optimistic UI. However, if you're not feeling up to it, or deadlines are tight, just us a `<form>` and let the browser handle the user feedback! Remix `<Form>` is the realization of "progressive enhancement" for mutations.

### Building the form

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

Now add the route action. Any form submissions that are "post" will call your data "action". Any "get" submissions (`<Form method="get">`) will be handled by your "loader".

```tsx [5-9]
import type { ActionFunction } from "remix";
import { redirect } from "remix";

// Note the "action" export name, this will handle our form POST
export let action: ActionFunction = async ({ request }) => {
  let formData = await request.formData();
  let project = await createProject(formData);
  return redirect(`/projects/${project.id}`);
};

export default function NewProject() {
  // ... same as before
}
```

And that's it! Assuming `createProject` does what we want it to, that's all you have to do. Note that no matter what kind of SPA you may have built in the past, you always need a server side action and a form to get data from the user. The difference with Remix is **that's all you need** (and that's how the web used to be, too.)

Of course, we started complicating things to try to create better user experiences than the default browser behavior. Keep going, we'll get there, but we won’t have to change any of the code we've already written to get the core functionality.

### Form Validation

It's common to validate forms both clientside and serverside. It's also (unfortunately) common to only validate clientside, which leads to various issues with your data that we don't have time to get into right now. Point is, if your validating in only one place, do it on the server. You find with Remix that's the only place you care to anymore (the less you send to the browser the better!).

We know, we know, you want to animate in nice validation errors and stuff. We'll get to that. But right now we're just building a basic HTML form and user flow. We'll keep it simple first, then make it fancy.

Back in our action, maybe we have an API that returns validation errors like this.

```tsx
let [errors, project] = await createProject(newProject);
```

If there are validation errors, we want to go back to the form and display them.

```tsx [3,5-8]
export let action: ActionFunction = async ({ request }) => {
  let formData = await request.formData();
  let [errors, project] = await createProject(formData);

  if (errors) {
    let values = Object.fromEntries(newProject);
    return { errors, values };
  }

  return redirect(`/projects/${project.id}`);
};
```

Just like `useLoaderData` returns the values from the `loader`, `useActionData` will return the data from the action. It will only be there if the navigation was a form submission, so you always have to check if you've got it or not.

```tsx [1,8,18,23-27,35,40-44]
import { redirect, useActionData } from "remix";

export let action: ActionFunction = async ({ request }) => {
  // ...
};

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
            defaultValue={actionData?.values.name}
          />
        </label>
      </p>

      {actionData?.errors.name && (
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
            defaultValue={actionData?.values.description}
          />
        </label>
      </p>

      {actionData?.errors.description && (
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

Notice how we add `defaultValue` to all of our inputs. Remember, this is regular HTML `<form>`, so it's just normal browser/server stuff happening. We're getting the values back from the server so the user doesn't have to re-type what they had.

You can ship this code as-is. The browser will handle the pending UI and interruptions for you. Enjoy your weekend and make it fancy on Monday.

### Graduate to `<Form>` and add pending UI

Let's use progressive enhancement to make this UX a bit more fancy. By changing it from `<Form reloadDocument>` to `<Form>`, Remix will emulate the browser behavior with `fetch`. It will also give you access to the pending form data so you can build pending UI.

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

We didn't do much with `transition` on this page, but it's got all the information about the submission on `transition.submission`, including all of the values being processed on the server on `submission.formData`.

### Animating in the Validation Errors

Now that we're using JavaScript to submit this page, our validation errors can be animated in because the page is stateful. First we'll make a fancy component that animates height and opacity:

```tsx
function ValidationMessage({ error, isSubmitting }) {
  let [show, setShow] = useState(!!error);

  useEffect(() => {
    let id = setTimeout(() => {
      let hasError = !!error;
      setShow(hasError && !isSubmitting);
    });
    return () => clearTimeout(id);
  }, [error, isSubmitting]);

  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        height: show ? "1em" : 0,
        color: "red",
        transition: "all 300ms ease-in-out"
      }}
    >
      {error}
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

        {actionData?.errors.name && (
          <ValidationMessage
            isSubmitting={transition.state === "submitting"}
            error={actionData?.errors?.name}
          />
        )}

        <p>
          <label>
            Description:
            <br />
            <textarea
              name="description"
              defaultValue={actionData?.values.description}
              style={{
                borderColor: actionData?.errors.description
                  ? "red"
                  : ""
              }}
            />
          </label>
        </p>

        <ValidationMessage
          isSubmitting={transition.state === "submitting"}
          error={actionData?.errors.description}
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

Boom! Fancy UI without having to change anything about how we communicate with the server. It's also resilient to network conditions that prevent JS from loading.

### Review

- First we built the project form without JavaScript in mind. A simple form, posting to a server side action. Welcome to 1998.

- Once that worked, we used JavaScript to submit the form by changing `<form>` to `<Form>`, but we didnt' have to do anything else!

- Now that there was a stateful page with React, we added loading indicators and animation for the validation errors by simply asking Remix for the state of the transition.

From your components perspective, all that happend was the `useTransition` hook caused a state update when the form was submitted, and then another state update when the data came back. Of course, a lot more happened inside of Remix, but as far as your component is concerned, that's it. Just a couple state updates. This makes it really easy to dress up any user flow.

## See also

- [Form](../api/remix#form)
- [useTransition](../api/remix#usetransition)
- [Actions](../api/conventions#action-export)
- [Loaders](../api/conventions#loader-export)
- [`useSubmit()`](../api/remix#usesubmit)
- [`useFetcher()`](../api/remix#usefetcher)
