import * as React from "react";
import { unstable_createRemixStub as createRemixStub } from "@remix-run/testing";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, Form } from "@remix-run/react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

function Index() {
  let actionData = useActionData();
  let data = useLoaderData();
  return (
    <div>
      <p data-testid="action">
        {actionData ? String(actionData.aborted) : "empty"}
      </p>
      <p data-testid="loader">{String(data.aborted)}</p>
      <Form method="post">
        <button type="submit">Submit</button>
      </Form>
    </div>
  );
}

let RemixStub = createRemixStub([
  {
    index: true,
    action: async ({ request }) => {
      // New event loop causes express request to close
      await new Promise((r) => setTimeout(r, 0));
      return json({ aborted: request.signal.aborted });
    },
    loader: async ({ request }) => {
      return json({ aborted: request.signal.aborted });
    },
    element: <Index />,
  },
]);

test("should not abort the request in a new event loop", async () => {
  render(<RemixStub />);

  await waitFor(() => screen.queryByTestId("action"));
  expect(screen.getByTestId("action")).toHaveTextContent("empty");
  expect(screen.getByTestId("loader")).toHaveTextContent("false");

  await userEvent.click(screen.getByRole("button"));

  await waitFor(() =>
    expect(screen.queryByTestId("action")).toHaveTextContent("false")
  );

  expect(screen.getByTestId("action")).toHaveTextContent("false");
  expect(screen.getByTestId("loader")).toHaveTextContent("false");
});
