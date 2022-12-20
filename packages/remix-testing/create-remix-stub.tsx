import * as React from "react";
import type { RouteData } from "@remix-run/react";
import type { RouteObject } from "react-router-dom";
import { RouterProvider } from "react-router-dom";
import { createMemoryRouter } from "react-router-dom";
import type { InitialEntry } from "@remix-run/router";
import { createStaticHandler } from "@remix-run/router";

type RemixStubOptions = {
  /**
   *  The initial entries in the history stack. This allows you to start a test with
   *  multiple locations already in the history stack (for testing a back navigation, etc.)
   *  The test will default to the last entry in initialEntries if no initialIndex is provided.
   *  e.g. initialEntries={["/home", "/about", "/contact"]}
   */
  initialEntries?: InitialEntry[];

  /**
   *  Used to set the route's initial loader data.
   *  e.g. initialLoaderData={{ "/contact": { locale: "en-US" } }}
   */
  initialLoaderData?: RouteData;

  /**
   *  Used to set the route's initial action data.
   *  e.g. initialActionData={{ "/login": { errors: { email: "invalid email" } }}
   */
  initialActionData?: RouteData;

  /**
   * The initial index in the history stack to render. This allows you to start a test at a specific entry.
   * It defaults to the last entry in initialEntries.
   * e.g.
   *   initialEntries: ["/", "/events/123"]
   *   initialIndex: 1 // start at "/events/123"
   */
  initialIndex?: number;
};

export function createRemixStub(routes: RouteObject[]) {
  // Setup request handler to handle requests to the mock routes
  let staticHandler = createStaticHandler(routes);
  return function RemixStub({
    initialEntries,
    initialIndex,
    initialActionData,
    initialLoaderData,
  }: RemixStubOptions) {
    let router = createMemoryRouter(staticHandler.dataRoutes, {
      initialEntries,
      initialIndex,
      hydrationData: {
        actionData: initialActionData,
        loaderData: initialLoaderData,
      },
    });

    return <RouterProvider router={router} />;
  };
}
