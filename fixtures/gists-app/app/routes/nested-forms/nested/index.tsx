import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Outlet, useActionData, useLoaderData } from "@remix-run/react";

export let loader: LoaderFunction = async ({ request }) => {
  let value = new URL(request.url).searchParams.get("subvalue");
  return json(value);
};

export let action: ActionFunction = async () => {
  return json("nested index action data");
};

export default function NestedFormsIndexLayout() {
  let actionData = useActionData<string>();
  let loaderData = useLoaderData<string | null>();

  return (
    <div>
      <Form method="post">
        {actionData ? <p>{actionData}</p> : null}
        <button type="submit">Submit Nested Index POST Form</button>
      </Form>

      <Form method="get">
        {loaderData ? <p>{loaderData}</p> : null}
        <input type="hidden" name="subvalue" value="data from get submission" />
        <button>Submit Nested Index GET Form</button>
      </Form>

      <Outlet />
    </div>
  );
}
