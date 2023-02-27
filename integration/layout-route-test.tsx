import * as React from "react";
import { unstable_createRemixStub as createRemixStub } from "@remix-run/testing";
import { Outlet } from "@remix-run/react";

import { render, screen, waitFor } from "./render";

let RemixStub = createRemixStub([
  {
    path: "/",
    element: (
      <div data-testid="layout-route">
        <Outlet />
      </div>
    ),
    children: [
      {
        index: true,
        element: <div data-testid="layout-index">Layout index</div>,
      },
      {
        path: "/subroute",
        element: <div data-testid="layout-subroute">Layout subroute</div>,
      },
    ],
  },
  {
    path: "/sandwiches",
    element: (
      <div data-testid="sandwiches-pathless-route">
        <Outlet />
      </div>
    ),
    children: [
      {
        index: true,
        element: (
          <div data-testid="sandwiches-pathless-index">
            Sandwiches pathless index
          </div>
        ),
      },
    ],
  },
]);

test("should render pathless index route", async () => {
  render(<RemixStub />);
  await waitFor(() => screen.getByTestId("layout-route"));
  await waitFor(() => screen.getByTestId("layout-index"));
});

test("should render pathless sub route", async () => {
  render(<RemixStub initialEntries={["/subroute"]} />);
  await waitFor(() => screen.getByTestId("layout-route"));
  await waitFor(() => screen.getByTestId("layout-subroute"));
});

test("should render pathless index as a sub route", async () => {
  render(<RemixStub initialEntries={["/sandwiches"]} />);
  await waitFor(() => screen.getByTestId("sandwiches-pathless-route"));
  await waitFor(() => screen.getByTestId("sandwiches-pathless-index"));
});
