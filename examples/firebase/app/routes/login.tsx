import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Link,
  useActionData,
  useLoaderData,
  useSubmit,
} from "@remix-run/react";
import { useCallback, useState } from "react";

import * as firebaseRest from "~/firebase-rest";
import {
  checkSessionCookie,
  signIn,
  signInWithToken,
} from "~/server/auth.server";
import { commitSession, getSession } from "~/sessions";
import { getRestConfig } from "~/server/firebase.server";

interface LoaderData {
  apiKey: string;
  domain: string;
}
export const loader: LoaderFunction = async ({ request }) => {
  const session = await getSession(request.headers.get("cookie"));
  const { uid } = await checkSessionCookie(session);
  const headers = {
    "Set-Cookie": await commitSession(session),
  };
  if (uid) {
    return redirect("/", { headers });
  }
  const { apiKey, domain } = getRestConfig();
  return json<LoaderData>({ apiKey, domain }, { headers });
};

interface ActionData {
  error?: string;
}
export const action: ActionFunction = async ({ request }) => {
  const form = await request.formData();
  const idToken = form.get("idToken");
  let sessionCookie;
  try {
    if (typeof idToken === "string") {
      sessionCookie = await signInWithToken(idToken);
    } else {
      const email = form.get("email");
      const password = form.get("password");
      const formError = json(
        { error: "Please fill all fields!" },
        { status: 400 }
      );
      if (typeof email !== "string") return formError;
      if (typeof password !== "string") return formError;
      sessionCookie = await signIn(email, password);
    }
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
  const [clientAction, setClientAction] = useState<ActionData>();
  const action = useActionData<ActionData>();
  const restConfig = useLoaderData<LoaderData>();
  const submit = useSubmit();

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      // To avoid rate limiting, we sign in client side if we can.
      const login = await firebaseRest.signInWithPassword(
        {
          email: event.currentTarget.email.value,
          password: event.currentTarget.password.value,
          returnSecureToken: true,
        },
        restConfig
      );
      if (firebaseRest.isError(login)) {
        setClientAction({ error: login.error.message });
        return;
      }
      submit({ idToken: login.idToken }, { method: "post" });
    },
    [submit, restConfig]
  );
  return (
    <div>
      <h1>Login</h1>
      {(clientAction?.error || action?.error) && (
        <p>{clientAction?.error || action?.error}</p>
      )}
      <form method="post" onSubmit={handleSubmit}>
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
          Login
        </button>
      </form>
      <p>
        Do you want to <Link to="/join">join</Link>?
      </p>
    </div>
  );
}
