---
title: useSubmit
---

# `useSubmit`

Returns the function that may be used to submit a `<form>` (or some raw `FormData`) to the server using the same process that `<Form>` uses internally `onSubmit`. If you're familiar with React Router's `useNavigate`, you can think about this as the same thing but for `<Form>` instead of `<Link>`.

This is useful whenever you need to programmatically submit a form. For example, you may wish to save a user preferences form whenever any field changes.

```tsx filename=app/routes/prefs.tsx lines=[2,14,18]
import { json } from "@remix-run/node"; // or cloudflare/deno
import { useSubmit, useTransition } from "@remix-run/react";

export async function loader() {
  return json(await getUserPreferences());
}

export async function action({ request }) {
  await updatePreferences(await request.formData());
  return redirect("/prefs");
}

function UserPreferences() {
  const submit = useSubmit();
  const transition = useTransition();

  function handleChange(event) {
    submit(event.currentTarget, { replace: true });
  }

  return (
    <Form method="post" onChange={handleChange}>
      <label>
        <input type="checkbox" name="darkMode" value="on" />{" "}
        Dark Mode
      </label>
      {transition.state === "submitting" ? (
        <p>Saving...</p>
      ) : null}
    </Form>
  );
}
```

This can also be useful if you'd like to automatically sign someone out of your website after a period of inactivity. In this case, we've defined inactivity as the user hasn't navigated to any other pages after 5 minutes.

```tsx lines=[1,10,15]
import { useSubmit, useTransition } from "@remix-run/react";
import { useEffect } from "react";

function AdminPage() {
  useSessionTimeout();
  return <div>{/* ... */}</div>;
}

function useSessionTimeout() {
  const submit = useSubmit();
  const transition = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      submit(null, { method: "post", action: "/logout" });
    }, 5 * 60_000);

    return () => clearTimeout(timer);
  }, [submit, transition]);
}
```
