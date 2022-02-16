import { Form, json, redirect } from "remix";

export async function action() {
  return redirect("/action-catches-from-loader?catch");
}

export async function loader({ request }) {
  if (new URL(request.url).searchParams.get("catch") != null) {
    throw json("loader catch data!", { status: 401 });
  }

  return null;
}

export default function ActionCatches() {
  return (
    <div data-test-id="/action-catches-from-loader">
      <h1>Action Catches from loader</h1>
      <Form method="post">
        <button type="submit">Go</button>
      </Form>
    </div>
  );
}
