import * as React from "react";
import { createMemoryRouter, RouterProvider, Outlet } from "react-router-dom";
import { render, screen } from "@testing-library/react";

import { RemixContext, Scripts } from "../components";
import { ScrollRestoration } from "../scroll-restoration";
import type { RemixContextObject } from "../entry";

import "@testing-library/jest-dom/extend-expect";

describe("<ScrollRestoration />", () => {
  let scrollTo = window.scrollTo;
  beforeAll(() => {
    window.scrollTo = () => {};
  });
  afterAll(() => {
    window.scrollTo = scrollTo;
  });

  let context: RemixContextObject = {
    routeModules: { root: { default: () => null } },
    manifest: {
      routes: {
        root: {
          hasLoader: false,
          hasAction: false,
          hasCatchBoundary: false,
          hasErrorBoundary: false,
          id: "root",
          module: "root.js",
        },
      },
      entry: { imports: [], module: "" },
      url: "",
      version: "",
    },
    future: { v2_meta: false },
  };

  it("should render a <script> tag", () => {
    let router = createMemoryRouter([
      {
        id: "root",
        path: "/",
        element: (
          <>
            <Outlet />
            <ScrollRestoration data-testid="scroll-script" />
            <Scripts />
          </>
        ),
      },
    ]);

    render(
      <RemixContext.Provider value={context}>
        <RouterProvider router={router} />
      </RemixContext.Provider>
    );
    let script = screen.getByTestId("scroll-script");
    expect(script instanceof HTMLScriptElement).toBe(true);
  });

  it("should pass props to <script>", () => {
    let router = createMemoryRouter([
      {
        id: "root",
        path: "/",
        element: (
          <>
            <Outlet />
            <ScrollRestoration
              data-testid="scroll-script"
              nonce="hello"
              crossOrigin="anonymous"
            />
            <Scripts />
          </>
        ),
      },
    ]);
    render(
      <RemixContext.Provider value={context}>
        <RouterProvider router={router} />
      </RemixContext.Provider>
    );
    let script = screen.getByTestId("scroll-script");
    expect(script).toHaveAttribute("nonce", "hello");
    expect(script).toHaveAttribute("crossorigin", "anonymous");
  });

  it.todo("should restore scroll position");
});
