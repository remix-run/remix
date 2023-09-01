---
title: Form Validation
---

# Form Validation

This guide walks you through implementing form validation for a simple signup form in Remix. Here, we focus on capturing the fundamentals to help you understand the essential elements of form validation in Remix, including actions, action data, and rendering errors.

## Step 1: Setting Up the Signup Form

We'll start by creating a basic signup form using the `Form` component from Remix.

```tsx filename=app/routes/signup.tsx
import { Form } from "@remix-run/react";

export default function Signup() {
  return (
    <Form method="post">
      <p>
        <input type="email" name="email" />
      </p>

      <p>
        <input type="password" name="password" />
      </p>

      <button type="submit">Sign Up</button>
    </Form>
  );
}
```

## Step 2: Defining the Action

In this step, we'll define a server action in the same file as our Signup component. Note that the aim here is to provide a broad overview of the mechanics involved rather than digging deep into form validation rules or error object structures. We'll use rudimentary checks for the email and password to demonstrate the core concepts.

```tsx filename=app/routes/signup.jsx
import { Form, redirect } from "@remix-run/react";

export default function Signup() {
  // omitted for brevity
}

export function action({ request }) {
  const formData = await request.formData();
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const errors = {};

  if (!email.includes("@")) {
    errors.email = "Invalid email address";
  }

  if (password.length < 12) {
    errors.password =
      "Password should be at least 12 characters";
  }

  if (Object.keys(errors).length > 0) {
    return errors;
  }

  // Redirect to dashboard if validation is successful
  return redirect("/dashboard");
}
```

If any validation errors are found, they are returned from the action to the client. This is our way of signaling to the UI that something needs to be corrected, otherwise the user will be redirected to the dashboard.

## Step 3: Displaying Validation Errors

Finally, we'll modify the Signup component to display validation errors, if any. We'll use `useActionData` to access and display these errors.

```tsx filename=app/routes/signup.jsx
import {
  Form,
  redirect,
  useActionData,
} from "@remix-run/react";

export default function Signup() {
  const errors = useActionData();

  return (
    <Form method="post">
      <p>
        <input type="email" name="email" />
        {errors?.email && <em>{errors.email}</em>}
      </p>

      <p>
        <input type="password" name="password" />
        {errors?.password && <em>{errors.password}</em>}
      </p>

      <button type="submit">Sign Up</button>
    </Form>
  );
}

export function action({ request }) {
  // omitted for brevity
}
```

## Conclusion

And there you have it! You've successfully set up a basic form validation flow in Remix. The beauty of this approach is that the errors will automatically display based on the action data, and they will be updated each time the user re-submits the form. This reduces the amount of boilerplate code you have to write, making your development process more efficient.
