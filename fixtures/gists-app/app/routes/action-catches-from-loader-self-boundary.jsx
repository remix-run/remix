import { Form, json, redirect, useCatch } from "remix";

export async function action() {
  return redirect("/action-catches-from-loader-self-boundary?catch");
}

/**
 *
 * @param {{request:Request}} param0
 * @returns
 */
export async function loader({ request }) {
  if (new URL(request.url).searchParams.get("catch") != null) {
    throw json("loader catch data!", { status: 401 });
  }

  return null;
}

export default function ActionCatches() {
  return (
    <div>
      <h1>Action Catches from loader self boundary</h1>
      <Form method="post">
        <button type="submit">Go</button>
      </Form>
    </div>
  );
}

export function CatchBoundary() {
  let caught = useCatch();

  return (
    <div data-test-id="/action-catches-from-loader-self-boundary">
      <h1>Action Catches Self Boundary</h1>
      <p>Status: {caught.status}</p>
      <pre>
        <code>{JSON.stringify(caught.data, null, 2)}</code>
      </pre>
    </div>
  );
}
