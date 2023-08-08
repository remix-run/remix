---
title: useActionData
toc: false
---

# `useActionData`

<docs-info>This hook is simply a re-export of [React Router's `useActionData`][rr-useactiondata].</docs-info>

This hook returns the JSON parsed data from your route action. It returns `undefined` if there hasn't been a submission at the current location yet.

```tsx lines=[3,12,21]
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json } from "@remix-run/node"; // or cloudflare/deno
import { Form, useActionData } from "@remix-run/react";

export async function action({ request }: ActionArgs) {
  const body = await request.formData();
  const name = body.get("visitorsName");
  return json({ message: `Hello, ${name}` });
}

export default function Invoices() {
  const data = useActionData<typeof action>();
  return (
    <Form method="post">
      <p>
        <label>
          What is your name?
          <input type="text" name="visitorsName" />
        </label>
      </p>
      <p>{data ? data.message : "Waiting..."}</p>
    </Form>
  );
}
```

The most common use-case for this hook is form validation errors. If the form isn't right, you can simply return the errors and let the user try again (instead of pushing all the errors into sessions and back out of the loader).

```tsx lines=[23,32,40-42,46-48]
import type { ActionArgs } from "@remix-run/node"; // or cloudflare/deno
import { json, redirect } from "@remix-run/node"; // or cloudflare/deno
import { Form, useActionData } from "@remix-run/react";

export async function action({ request }: ActionArgs) {
  const form = await request.formData();
  const email = form.get("email");
  const password = form.get("password");
  const errors = {};

  // validate the fields
  if (typeof email !== "string" || !email.includes("@")) {
    errors.email =
      "That doesn't look like an email address";
  }

  if (typeof password !== "string" || password.length < 6) {
    errors.password = "Password must be > 6 characters";
  }

  // return data if we have errors
  if (Object.keys(errors).length) {
    return json(errors, { status: 422 });
  }

  // otherwise create the user and redirect
  await createUser(form);
  return redirect("/dashboard");
}

export default function Signup() {
  const errors = useActionData<typeof action>();

  return (
    <>
      <h1>Signup</h1>
      <Form method="post">
        <p>
          <input type="text" name="email" />
          {errors?.email ? (
            <span>{errors.email}</span>
          ) : null}
        </p>
        <p>
          <input type="text" name="password" />
          {errors?.password ? (
            <span>{errors.password}</span>
          ) : null}
        </p>
        <p>
          <button type="submit">Sign up</button>
        </p>
      </Form>
    </>
  );
}
```

#### Notes about resubmissions

When using `<Form>` (instead of `<form>` or `<Form reloadDocument>`), Remix _does not_ follow the browser's behavior of resubmitting forms when the user clicks back, forward, or refreshes into the location.

<docs-info>Remix client-side navigation does not resubmit forms on pop events like browsers.</docs-info>

Form submissions are navigation events in browsers (and Remix), which means users can click the back button into a location that had a form submission _and the browser will resubmit the form_. You usually don't want this to happen.

For example, consider this user flow:

1. The user lands at `/buy`
2. They submit a form to `/checkout`
3. They click a link to `/order/123`

The history stack looks like this, where "\*" is the current entry:

```
GET /buy > POST /checkout > *GET /order/123
```

Now consider the user clicks the back button 😨

```
GET /buy - *POST /checkout < GET /order/123
```

The browser will repost the same information and likely charge their credit card again. You usually don't want this.

The decades-old best practice is to redirect in the POST request. This way the location disappears from the browser's history stack and the user can't "back into it" anymore.

```
GET /buy > POST /checkout, Redirect > GET /order/123
```

This results in a history stack that looks like this:

```
GET /buy - *GET /order/123
```

Now the user can click back without resubmitting the form.

**When you should worry about this**

Usually your actions will either return validation issues or redirect, and then your data and your user's are safe no matter how the form is submitted. But to go into further detail, if you're using:

- `<form>`
- `<Form reloadDocument>`
- You're not rendering `<Scripts/>`
- The user has JavaScript disabled

The browser will resubmit the form in these situations unless you redirect from the action. If these are cases you want to support, we recommend you follow the age-old best practice of redirecting from actions.

If you're using `<Form>` and don't care to support the cases above, you don't need to redirect from your actions. However, if you don't redirect from an action, make sure reposting the same information isn't dangerous to your data or your visitors because you can't control if they have JavaScript enabled or not.

<docs-info>In general, if the form validation fails, return data from the action and render it in the component. But, once you actually change data (in your database, or otherwise), you should redirect.</docs-info>

<docs-info>For more information and usage, please refer to the [React Router `useActionData` docs][rr-useactiondata].</docs-info>

See also:

- [`action`][action]
- [`useNavigation`][usenavigation]

[action]: ../route/action
[usenavigation]: ../hooks/use-navigation
[rr-useactiondata]: https://reactrouter.com/hooks/use-action-data
