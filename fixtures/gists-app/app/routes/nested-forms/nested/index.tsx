import type { ActionFunction, LoaderFunction } from "remix";
import { Form, json, useActionData, useLoaderData, useFormAction } from "remix";
import { Outlet, useHref } from "react-router-dom";

export let loader: LoaderFunction = ({ request }) => {
  let value = new URL(request.url).searchParams.get("subvalue");
  return json(value);
};

export let action: ActionFunction = ({ request }) => {
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
        <input type="hidden" name="subvalue" value="data from get submition" />
        <button>Submit Nested Index GET Form</button>
      </Form>

      <Outlet />
    </div>
  );
}
