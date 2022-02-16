import type { ActionFunction, LoaderFunction, MetaFunction } from "remix";
import {
  Form,
  Link,
  redirect,
  useSearchParams,
  json,
  useActionData
} from "remix";
import Alert from "@reach/alert";

import { getUserId, createUserSession } from "~/session.server";

import { createUser } from "~/models/user.server";

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
  const returnTo = formData.get("returnTo");

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

  const user = await createUser(email, password);

  if (!user) {
    return json<ActionData>(
      { errors: { email: "Invalid email or password" } },
      { status: 400 }
    );
  }

  return createUserSession(
    request,
    user.id,
    typeof returnTo === "string" ? returnTo : "/"
  );
};

export const meta: MetaFunction = () => {
  return {
    title: "Join"
  };
};

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("redirectTo") ?? undefined;
  const actionData = useActionData<ActionData>();

  return (
    <>
      <h1>Join</h1>
      <Form
        method="post"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        <input type="hidden" name="redirectTo" value={returnTo} />
        <div>
          <label>
            <span>Email address</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={actionData?.errors?.email ? true : undefined}
              aria-errormessage={
                actionData?.errors.email ? "email-error" : undefined
              }
            />
          </label>
          {actionData?.errors?.email && (
            <Alert style={{ color: "red", paddingTop: 4 }} id="email-error">
              {actionData.errors.email}
            </Alert>
          )}
        </div>

        <div>
          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={actionData?.errors?.password ? true : undefined}
              aria-errormessage={
                actionData?.errors.password ? "password-error" : undefined
              }
            />
          </label>
          {actionData?.errors?.password && (
            <Alert style={{ color: "red", paddingTop: 4 }} id="password-error">
              {actionData.errors.password}
            </Alert>
          )}
        </div>

        <div>
          <button type="submit">Join</button>
        </div>
      </Form>

      <div style={{ paddingTop: 8 }}>
        Already have an account?{" "}
        <Link
          to={{
            pathname: "/login",
            search: returnTo ? `?returnTo=${returnTo}` : undefined
          }}
        >
          Log in
        </Link>
      </div>
    </>
  );
}
