import type { LoaderFunction } from "remix";
import { Form, json, Outlet, useActionData, useLoaderData } from "remix";

export let loader: LoaderFunction = ({ request }) => {
  let value = new URL(request.url).searchParams.get("value");
  return json(value);
};

export function action() {
  return json("nested layout action data");
}

export default function NestedFormsIndexLayout() {
  let actionData = useActionData<string>();
  let loaderData = useLoaderData<string | null>();

  return (
    <div>
      <Form method="post">
        {actionData ? <p>{actionData}</p> : null}
        <button type="submit">Submit Nested POST Form</button>
      </Form>

      <Form method="get">
        {loaderData ? <p>{loaderData}</p> : null}
        <input type="hidden" name="value" value="data from get submission" />
        <button type="submit">Submit Nested GET Form</button>
      </Form>

      <Outlet />
    </div>
  );
}
