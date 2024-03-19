import * as React from "react";
import { createMemoryRouter, defer } from "react-router-dom";
import { StaticRouterProvider } from "react-router-dom/server";
import { render } from "@testing-library/react";
import type { EntryContext } from "@remix-run/server-runtime";

import { Scripts, RemixContext } from "../components";

import "@testing-library/jest-dom/extend-expect";

/**
 * Don't try to add additional tests for <Scripts /> to this file!
 *
 * <Scripts /> gates most of its functionality on the **unexported**
 * variable isHydrated, defined inside ../components, and it sets that
 * variable the first time it is rendered. This means that subsequent
 * calls to <Scripts /> will skip writing actual script tags.
 *
 * Using jest.resetModules() or .isolateModules() won't help here as
 * we'd need to re-import or re-require [1]. Re-importing would need new
 * packages to work [2] and re-requiring has problems with React [3].
 *
 * [1]: https://github.com/jestjs/jest/issues/3236
 * [2]: https://github.com/jestjs/jest/issues/3236#issuecomment-698271251
 * [3]: https://github.com/jestjs/jest/issues/11471
 */

describe("<Scripts /> with activeDeferreds", () => {
  it("should pass custom props", () => {
    let context: EntryContext = {
      future: {
        v3_throwAbortReason: false,
        v3_fetcherPersist: false,
        v3_relativeSplatPath: false,
        unstable_singleFetch: false,
      },
      routeModules: { root: { default: () => null } },
      manifest: {
        routes: {
          root: {
            hasLoader: false,
            hasAction: false,
            hasErrorBoundary: false,
            id: "root",
            module: "root.js",
          },
        },
        entry: { imports: [], module: "" },
        url: "",
        version: "",
      },
      // @ts-expect-error
      // Similarly, we have no interest in the rest of the static handler
      // context. We're not trying to write a test for React Router, we
      // just want to trick <Scripts /> into thinking there's a need for
      // deferred scripts. We'll look for "key with a promise" to check that
      // this isn't being ignored.
      staticHandlerContext: {
        activeDeferreds: {
          "/": defer({
            "key with a promise": new Promise((resolve) => resolve("value")),
          }),
        },
      },
    };

    let router = createMemoryRouter([
      {
        id: "root",
        path: "/",
        element: <Scripts nonce="some nonce" />,
      },
    ]);

    let { container } = render(
      <RemixContext.Provider value={context}>
        <StaticRouterProvider
          router={router}
          context={context.staticHandlerContext}
          // We're testing <Scripts />, but <StaticRouterProvider /> can insert
          // its own script tags too, so we pass it the same nonce prop so our
          // check for "do all script tags have the nonce prop" still works.
          nonce="some nonce"
        />
      </RemixContext.Provider>
    );

    let scriptElements = Array.from(container.getElementsByTagName("script"));

    // Confirm that activeDeferreds is being handled
    expect(
      scriptElements.filter((elem) =>
        elem.innerHTML.includes("key with a promise")
      ).length
    ).toBeGreaterThan(0);

    // Test that all script tags have the additional nonce prop
    scriptElements.forEach((elem) =>
      expect(elem).toHaveAttribute("nonce", "some nonce")
    );
  });
});
