import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData } from "@remix-run/react";

import { checkSessionCookie, signUp } from "~/server/auth.server";
import { commitSession, getSession } from "~/sessions";

export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));
  const { uid } = await checkSessionCookie(session);
  const headers = {
    "Set-Cookie": await commitSession(session),
  };
  if (uid) {
    return redirect("/", { headers });
  }
  return json(null, { headers });
};

type ActionData = {
  error?: string;
};

export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const name = form.get("name");
  const email = form.get("email");
  const password = form.get("password");
  const formError = json({ error: "Please fill all fields!" }, { status: 400 });
  if (typeof name !== "string") return formError;
  if (typeof email !== "string") return formError;
  if (typeof password !== "string") return formError;
  try {
    const sessionCookie = await signUp(name, email, password);
    const session = await getSession(request.headers.get("cookie"));
    session.set("session", sessionCookie);
    return redirect("/", {
      headers: {
        "Set-Cookie": await commitSession(session),
      },
    });
  } catch (error) {
    console.error(error);
    return json<ActionData>({ error: String(error) }, { status: 401 });
  }
};

export default function Login() {
  const action = useActionData<ActionData>();
  return (
    <div>
      <h1>Join</h1>
      {action?.error && <p>{action.error}</p>}
      <Form method="post">
        <input
          style={{ display: "block" }}
          name="name"
          placeholder="Peter"
          type="text"
        />
        <input
          style={{ display: "block" }}
          name="email"
          placeholder="you@example.com"
          type="email"
        />
        <input
          style={{ display: "block" }}
          name="password"
          placeholder="password"
          type="password"
        />
        <button style={{ display: "block" }} type="submit">
          Join
        </button>
      </Form>
      <p>
        Do you want to <Link to="/login">login</Link>?
      </p>
    </div>
  );
}
