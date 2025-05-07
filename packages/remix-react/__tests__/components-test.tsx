import { createStaticHandler } from "@remix-run/router";
import { act, fireEvent, render } from "@testing-library/react";
import * as React from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";

import { RemixBrowser } from "../browser";
import type { LiveReload as ActualLiveReload } from "../components";
import { Link, NavLink, RemixContext } from "../components";
import invariant from "../invariant";
import { RemixServer } from "../server";
import "@testing-library/jest-dom/extend-expect";

// TODO: Every time we touch LiveReload (without changing the API) these tests
// fail, which tells me they're testing implementation details and not actual
// behavior. Not sure how valuable they are. Disabling them until we can come up
// with a better strategy for testing "developer workflow" things. An ideal
// solution will let us fire up a development server, save a file, and observe
// the browser reloads with the new UI. At the moment we could completely break
// LiveReload's real features and these tests wouldn't know it.

describe("<LiveReload />", () => {
  let originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("non-development environment", () => {
    let LiveReload: typeof ActualLiveReload;
    beforeEach(() => {
      process.env.NODE_ENV = "not-development";
      jest.resetModules();
      LiveReload = require("../components").LiveReload;
    });

    it("does nothing if the NODE_ENV is not development", () => {
      let { container } = render(<LiveReload />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("development environment", () => {
    let oldEnv = process.env;
    let LiveReload: typeof ActualLiveReload;
    beforeEach(() => {
      process.env = { ...oldEnv, NODE_ENV: "development" };
      jest.resetModules();
    });

    it("defaults the origin to REMIX_DEV_ORIGIN env variable", () => {
      let origin = "http://test-origin";
      LiveReload = require("../components").LiveReload;
      process.env = { ...oldEnv, REMIX_DEV_ORIGIN: origin };
      let { container } = render(<LiveReload />);
      expect(container.querySelector("script")).toHaveTextContent(
        `let LIVE_RELOAD_ORIGIN = ${JSON.stringify(origin)};`
      );
    });

    it("can set the origin explicitly", () => {
      let origin = "http://test-origin";
      LiveReload = require("../components").LiveReload;
      let { container } = render(<LiveReload origin={origin} />);
      expect(container.querySelector("script")).toHaveTextContent(
        `let LIVE_RELOAD_ORIGIN = ${JSON.stringify(origin)};`
      );
    });

    it("defaults the port to 8002", () => {
      LiveReload = require("../components").LiveReload;
      let { container } = render(<LiveReload />);
      expect(container.querySelector("script")).toHaveTextContent(
        "url.port = undefined || (LIVE_RELOAD_ORIGIN ? new URL(LIVE_RELOAD_ORIGIN).port : 8002);"
      );
    });

    it("can set the port explicitly", () => {
      let { container } = render(<LiveReload port={4321} />);
      expect(container.querySelector("script")).toHaveTextContent(
        "url.port = 4321 || (LIVE_RELOAD_ORIGIN ? new URL(LIVE_RELOAD_ORIGIN).port : 8002);"
      );
    });

    it("timeout of reload is set to 200ms", () => {
      LiveReload = require("../components").LiveReload;
      let { container } = render(<LiveReload timeoutMs={200} />);
      expect(container.querySelector("script")).toHaveTextContent(
        "setTimeout( () => remixLiveReloadConnect({ onOpen: () => window.location.reload(), }), 200 );"
      );
    });
  });
});

const setIntentEvents = ["focus", "mouseEnter", "touchStart"] as const;
type PrefetchEventHandlerProps = {
  [Property in `on${Capitalize<typeof setIntentEvents[number]>}`]?: Function;
};

function itPrefetchesPageLinks<
  Props extends { to: any; prefetch?: any } & PrefetchEventHandlerProps
>(Component: React.ComponentType<Props>) {
  describe('prefetch="intent"', () => {
    let context = {
      routeModules: { idk: { default: () => null } },
      manifest: {
        routes: {
          idk: {
            hasLoader: true,
            hasAction: false,
            hasErrorBoundary: false,
            id: "idk",
            module: "idk.js",
          },
        },
        entry: { imports: [], module: "" },
        url: "",
        version: "",
      },
      future: {},
    };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    setIntentEvents.forEach((event) => {
      it(`prefetches page links on ${event}`, () => {
        let router;

        act(() => {
          router = createMemoryRouter([
            {
              id: "root",
              path: "/",
              element: (
                <Component {...({ to: "idk", prefetch: "intent" } as Props)} />
              ),
            },
            {
              id: "idk",
              path: "idk",
              loader: () => null,
              element: <h1>idk</h1>,
            },
          ]);
        });

        let { container, unmount } = render(
          <RemixContext.Provider value={context}>
            <RouterProvider router={router} />
          </RemixContext.Provider>
        );

        fireEvent[event](container.firstChild);
        act(() => {
          jest.runAllTimers();
        });

        let dataHref = container
          .querySelector('link[rel="prefetch"][as="fetch"]')
          ?.getAttribute("href");
        expect(dataHref).toBe("/idk?_data=idk");
        let moduleHref = container
          .querySelector('link[rel="modulepreload"]')
          ?.getAttribute("href");
        expect(moduleHref).toBe("idk.js");
        unmount();
      });

      it(`prefetches page links and calls explicit handler on ${event}`, () => {
        let router;
        let ranHandler = false;
        let eventHandler = `on${event[0].toUpperCase()}${event.slice(1)}`;
        act(() => {
          router = createMemoryRouter([
            {
              id: "root",
              path: "/",
              element: (
                <Component
                  {...({
                    to: "idk",
                    prefetch: "intent",
                    [eventHandler]: () => {
                      ranHandler = true;
                    },
                  } as any)}
                />
              ),
            },
            {
              id: "idk",
              path: "idk",
              loader: () => true,
              element: <h1>idk</h1>,
            },
          ]);
        });

        let { container, unmount } = render(
          <RemixContext.Provider value={context}>
            <RouterProvider router={router} />
          </RemixContext.Provider>
        );

        fireEvent[event](container.firstChild);
        act(() => {
          jest.runAllTimers();
        });

        expect(container.querySelector("link[rel=prefetch]")).toBeTruthy();
        expect(ranHandler).toBe(true);
        unmount();
      });
    });
  });
}

describe("<Link />", () => {
  itPrefetchesPageLinks(Link);
});

describe("<NavLink />", () => {
  itPrefetchesPageLinks(NavLink);
});

describe("<RemixServer>", () => {
  it("handles empty default export objects from the compiler", async () => {
    let staticHandlerContext = await createStaticHandler([{ path: "/" }]).query(
      new Request("http://localhost/")
    );
    invariant(
      !(staticHandlerContext instanceof Response),
      "Expected a context"
    );

    let context = {
      manifest: {
        routes: {
          root: {
            hasLoader: false,
            hasAction: false,
            hasErrorBoundary: false,
            id: "root",
            module: "root.js",
            path: "/",
          },
          empty: {
            hasLoader: false,
            hasAction: false,
            hasErrorBoundary: false,
            id: "empty",
            module: "empty.js",
            index: true,
            parentId: "root",
          },
        },
        entry: { imports: [], module: "" },
        url: "",
        version: "",
      },
      routeModules: {
        root: {
          default: () => {
            return (
              <>
                <h1>Root</h1>
                <Outlet />
              </>
            );
          },
        },
        empty: { default: {} },
      },
      staticHandlerContext,
      future: {},
    };

    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error");

    let { container } = render(
      <RemixServer context={context} url="http://localhost/" />
    );

    expect(console.warn).toHaveBeenCalledWith(
      'Matched leaf route at location "/" does not have an element or Component. This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.'
    );
    expect(console.error).not.toHaveBeenCalled();
    expect(container.innerHTML).toMatch("<h1>Root</h1>");
  });
});

describe("<RemixBrowser>", () => {
  it("handles empty default export objects from the compiler", () => {
    window.__remixContext = {
      url: "/",
      state: {
        loaderData: {},
      },
      future: {},
    };
    window.__remixRouteModules = {
      root: {
        default: () => {
          return (
            <>
              <h1>Root</h1>
              <Outlet />
            </>
          );
        },
      },
      empty: { default: {} },
    };
    window.__remixManifest = {
      routes: {
        root: {
          hasLoader: false,
          hasAction: false,
          hasErrorBoundary: false,
          id: "root",
          module: "root.js",
          path: "/",
        },
        empty: {
          hasLoader: false,
          hasAction: false,
          hasErrorBoundary: false,
          id: "empty",
          module: "empty.js",
          index: true,
          parentId: "root",
        },
      },
      entry: { imports: [], module: "" },
      url: "",
      version: "",
    };

    jest.spyOn(console, "error");

    let { container } = render(<RemixBrowser />);

    expect(console.error).not.toHaveBeenCalled();
    expect(container.innerHTML).toMatch("<h1>Root</h1>");
  });
});
