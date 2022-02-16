import type { ActionFunction, LoaderFunction, MetaFunction } from "remix";
import { Form, json, Link, useActionData } from "remix";
import { redirect } from "remix";
import Alert from "@reach/alert";

import { createUserSession, getUserId } from "~/session.server";
import { createUser, getUserByEmail } from "~/models/user";

export const loader: LoaderFunction = async ({ request }) => {
  const userId = await getUserId(request);
  if (userId) return redirect("/");
  return {};
};

interface ActionData {
  errors: {
    email?: string;
    password?: string;
  };
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();

  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || email.length === 0) {
    return json<ActionData>(
      { errors: { email: "Email is required" } },
      { status: 400 }
    );
  }

  if (typeof password !== "string" || password.length === 0) {
    return json<ActionData>(
      { errors: { password: "Password is required" } },
      { status: 400 }
    );
  }

  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    return json<ActionData>(
      { errors: { email: "Email already exists" } },
      { status: 400 }
    );
  }

  const user = await createUser(email, password);

  return createUserSession(request, user.pk, "/");
};

export const meta: MetaFunction = () => ({
  title: "Join"
});

export default function JoinPage() {
  const actionData = useActionData<ActionData>();

  return (
    <>
      <h1>Join</h1>
      <Form
        method="post"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <label>
          <span>Email: </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            aria-invalid={actionData?.errors?.email ? true : undefined}
            aria-errormessage={
              actionData?.errors.email ? "email-error" : undefined
            }
          />
          {actionData?.errors?.email && (
            <Alert style={{ color: "red", paddingTop: 4 }} id="email-error">
              {actionData.errors.email}
            </Alert>
          )}
        </label>
        <label>
          <span>Password: </span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            aria-invalid={actionData?.errors?.password ? true : undefined}
            aria-errormessage={
              actionData?.errors.password ? "password-error" : undefined
            }
          />
          {actionData?.errors?.password && (
            <Alert style={{ color: "red", paddingTop: 4 }} id="password-error">
              {actionData.errors.password}
            </Alert>
          )}
        </label>
        <div>
          <button type="submit">Join</button>
        </div>
      </Form>
      <div style={{ paddingTop: 8 }}>
        Already have an account? <Link to="/login">Log in</Link>
      </div>
    </>
  );
}
