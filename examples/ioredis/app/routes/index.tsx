import type { ActionFunction, LoaderFunction } from "remix";
import { redirect } from "remix";
import { useActionData } from "remix";
import { Form, json, useLoaderData } from "remix";
import { redis } from "~/utils/redis.server";

export const loader: LoaderFunction = async ({ request }) => {
  const message = await redis.get("message");
  return { message };
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const message = formData.get("message");

  if (!message || typeof message !== "string") {
    return json("String only!", { status: 400 });
  }

  await redis.set("message", message);

  return redirect("/");
};

export default function () {
  const data = useLoaderData();
  const actionMessage = useActionData<string>();

  return (
    <main>
      <div>
        <b>Stored Message:</b> {data.message}
      </div>
      <Form method="post">
        <h2>Change the message</h2>
        <label>
          <div>Message</div>
          <input name="message" defaultValue={data.message ?? ""} />
        </label>
        <div>
          <button type="submit">Save</button>
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
