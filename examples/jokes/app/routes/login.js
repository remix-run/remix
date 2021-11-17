import { useActionData, Form, redirect } from "remix";

import { login } from "~/utils/user.server";

export let action = async ({ request }) => {
  let form = await request.formData();
  let loginCredentials = {
    loginType: form.get("loginType"),
    username: form.get("username"),
    password: form.get("password"),
  };

  if (!loginCredentials.success) {
    return loginCredentials.error.flatten();
  }

  await login(loginCredentials.data);
  return redirect("/");
};
export default function Login() {
  let actionData = useActionData();
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
