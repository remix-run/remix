import * as React from "react";
import { unstable_createRemixStub as createRemixStub } from "@remix-run/testing";
import { Link, useLoaderData } from "@remix-run/react";
import { defer } from "@remix-run/node";

import { render, screen, userEvent, waitFor } from "./render";

let count = 0;
function DirectPromiseAccess() {
  let { bar } = useLoaderData();
  React.useEffect(() => {
    let aborted = false;
    bar.then((data: any) => {
      if (aborted) return;
      let content = document.getElementById("content");
      if (content) {
        content.innerHTML = data + " " + ++count;
        content.setAttribute("data-testid", "content");
      }
    });
    return () => {
      aborted = true;
    };
  }, [bar]);
  return <div id="content">Waiting for client hydration...</div>;
}

let RemixStub = createRemixStub([
  {
    index: true,
    element: (
      <div>
        <Link to="/redirect">Redirect</Link>
        <Link to="/direct-promise-access">Direct Promise Access</Link>
      </div>
    ),
  },
  {
    path: "/redirect",
    loader() {
      return defer(
        { food: "pizza" },
        { status: 301, headers: { Location: "/?redirected" } }
      );
    },
    element: <div />,
  },
  {
    path: "/direct-promise-access",
    loader() {
      return defer({
        bar: new Promise(async (resolve, reject) => {
          resolve("hamburger");
        }),
      });
    },
    element: <DirectPromiseAccess />,
  },
]);

test("deferred response can redirect on document request", async () => {
  render(<RemixStub initialEntries={["/redirect"]} />);
  await waitFor(() => window.location.href.includes("?redirected"));
});

test("deferred response can redirect on transition", async () => {
  render(<RemixStub initialEntries={["/"]} />);
  await waitFor(() => screen.getByText("Redirect"));
  await userEvent.click(screen.getByText("Redirect"));
  await waitFor(() => window.location.href.includes("?redirected"));
});

test("can directly access result from deferred promise on document request", async () => {
  render(<RemixStub initialEntries={["/direct-promise-access"]} />);
  await waitFor(() => screen.getByText("Waiting for client hydration..."));
  await waitFor(() => screen.getByTestId("content"));
  expect(screen.getByTestId("content")).toHaveTextContent("hamburger 1");
});
