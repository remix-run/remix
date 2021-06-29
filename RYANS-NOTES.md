## How to clean up action refs?

I _think_ this will work?

```js
function useSubmission(ref) {
  useEffect(() => {
    if (!ref.current) {
      tm.cleanRef(ref.current);
    }
    return () => tm.cleanRef(ref.current);
  });
}
```

---

```tsx
export function action({ request }) {
  let body = Object.fromEntries(new URLSearchParams(await request.text()));
  let errors = {};

  // validate the fields
  if (!body.email.includes("@")) {
    errors.email = "That doesn't look like an email address";
  }

  if (body.password.length < 6) {
    errors.password = "Password must be > 6 characters";
  }

  // if we have validation errors, return them, no more messing around with
  // sessions and redirecting to this same page
  if (Object.keys(errors).length) {
    return json(errors, { status: 422 });
  }

  // otherwise create the user and redirect
  await createUser(body);
  return redirect("/dashboard");
}

export default function Comp() {
  let errors = useActionData();

  return (
    <>
      <h1>Login</h1>
      <Form method="post">
        <p>
          <input type="text" name="email" />
          {errors?.email && <span className="error">{errors.email}</span>}
        </p>
        <p>
          <input type="text" name="password" />
          {errors?.password && <span className="error">{errors.password}</span>}
        </p>
        <p>
          <button type="submit">Sign up</button>
        </p>
      </Form>
    </>
  );
}
```
