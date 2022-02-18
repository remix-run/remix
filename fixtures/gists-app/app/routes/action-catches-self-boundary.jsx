import { Form, json, useCatch } from "remix";

export async function action() {
  throw json("action catch data!", { status: 401 });
}

export default function ActionCatchesSelfBoundary() {
  return (
    <div data-test-id="/action-catches">
      <h1>Action Catches Self Boundary</h1>
      <Form method="post">
        <button type="submit">Go</button>
      </Form>
    </div>
  );
}

export function CatchBoundary() {
  let caught = useCatch();

  return (
    <div data-test-id="/action-catches-self-boundary">
      <h1>Action Catches Self Boundary</h1>
      <p>Status: {caught.status}</p>
      <pre>
        <code>{JSON.stringify(caught.data, null, 2)}</code>
      </pre>
    </div>
  );
}
