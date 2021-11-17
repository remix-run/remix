import { useActionData, Form, redirect } from "remix";
import type { ActionFunction } from "remix";
import { z } from "zod";

import { login, LoginForm } from "~/utils/user.server";

let ActionError = z.union([
  z.undefined(),
  z.object({
    formErrors: z.array(z.string()),
    fieldErrors: z.object({
      username: z.array(z.string()).optional(),
      password: z.array(z.string()).optional(),
    }),
  }),
]);

export let action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const loginCredentials = LoginForm.safeParse({
    // loginType: form.get("loginType"),
    username: form.get("username"),
    password: form.get("password"),
  });
  if (!loginCredentials.success) {
    return loginCredentials.error.flatten();
  }
  await login(loginCredentials.data);
  return redirect("/me");
};

export default function Login() {
  const actionData = ActionError.parse(useActionData());
  return (
    <div>
      <h2>Login</h2>
      <Form
        method="post"
        aria-describedby={
          actionData?.formErrors.length ? "form-error-messages" : undefined
        }
      >
        <div>
          <label>
            <input type="radio" name="loginType" value="login" defaultChecked />{" "}
            Login
          </label>
          <label>
            <input type="radio" name="loginType" value="register" /> Register
          </label>
        </div>
        <div>
          <label htmlFor="username-input">Username</label>
          <input
            id="username-input"
            name="username"
            aria-labelledby={
              actionData?.fieldErrors.username ? "username-error" : undefined
            }
          />
          {actionData?.fieldErrors.username ? (
            <p>{actionData?.fieldErrors.username}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="password-input">Password</label>
          <input
            id="password-input"
            name="password"
            type="password"
            aria-labelledby={
              actionData?.fieldErrors.password ? "password-error" : undefined
            }
          />
          {actionData?.fieldErrors.password ? (
            <p>{actionData?.fieldErrors.password}</p>
          ) : null}
        </div>
        <div id="form-error-messages">
          {actionData?.formErrors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
        <button type="submit">Submit</button>
      </Form>
    </div>
  );
}
