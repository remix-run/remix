import { useEffect, useRef } from "react";
import {
  ActionFunction,
  Form,
  Link,
  useActionData,
  useTransition,
} from "remix";

export let action: ActionFunction = async ({ request }) => {
  await new Promise((res) => setTimeout(res, 1000));
  let formData = await request.formData();
  let email = formData.get("email");

  const API_KEY = "...";
  const FORM_ID = "...";
  const API = "https://api.convertkit.com/v3";

  let res = await fetch(`${API}/forms/${FORM_ID}/subscribe`, {
    method: "post",
    body: JSON.stringify({ email, api_key: API_KEY }),
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });

  return res.json();
};

export default function Newsletter() {
  let actionData = useActionData();
  let transition = useTransition();
  let state: "idle" | "success" | "error" | "submitting" = transition.submission
    ? "submitting"
    : actionData?.subscription
    ? "success"
    : actionData?.error
    ? "error"
    : "idle";

  let inputRef = useRef<HTMLInputElement>(null);
  let successRef = useRef<HTMLHeadingElement>(null);
  let mounted = useRef<boolean>(false);

  useEffect(() => {
    if (state === "error") {
      inputRef.current?.focus();
    }

    if (state === "idle" && mounted.current) {
      inputRef.current?.select();
    }

    if (state === "success") {
      successRef.current?.focus();
    }

    mounted.current = true;
  }, [state]);

  return (
    <main>
      <Form replace method="post" aria-hidden={state === "success"}>
        <h2>Subscribe!</h2>
        <p>Don't miss any of the action!</p>
        <fieldset>
          <input
            aria-label="Email address"
            aria-describedby="error-message"
            ref={inputRef}
            type="email"
            name="email"
            placeholder="you@example.com"
          />
          <button type="submit">
            {state === "submitting" ? "Subscribing..." : "Subscribe"}
          </button>
        </fieldset>

        <p id="error-message">
          {state === "error" ? actionData.message : <>&nbsp;</>}
        </p>
      </Form>

      <div aria-hidden={state !== "success"}>
        <h2 ref={successRef} tabIndex={-1}>
          You're subscribed!
        </h2>
        <p>Please check your email to confirm your subscription.</p>
        <Link to=".">Start over</Link>
      </div>
    </main>
  );
}
