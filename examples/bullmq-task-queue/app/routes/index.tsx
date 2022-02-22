import type { ActionFunction } from "remix";
import { Form, json, useActionData, useTransition } from "remix";

import { queue } from "~/queues/notifier.server";

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email");

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return json("Invalid email!", { status: 400 });
  }

  // Jobs are queued and not processed immediately.
  // This function is asyncronous because it is writing
  // the job to redis for our worker to later pick up.
  await queue.add("notification email", {
    emailAddress: email
  });

  return json(`Email queued for ${email}!`);
};

export default function Index() {
  const actionMessage = useActionData<string>();
  const transition = useTransition();

  return (
    <main>
      <Form method="post">
        <h2>Send an email</h2>
        <label>
          <div>Email Address</div>
          <input name="email" />
        </label>
        <div>
          <button type="submit">
            {transition.state === "idle" ? "Send" : "Sending"}
          </button>
        </div>
      </Form>
      {actionMessage ? (
        <p>
          <b>{actionMessage}</b>
        </p>
      ) : null}
    </main>
  );
}
