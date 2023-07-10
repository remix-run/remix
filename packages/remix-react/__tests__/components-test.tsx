import * as React from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { fireEvent, render, act } from "@testing-library/react";

import type { LiveReload as ActualLiveReload } from "../components";
import { Link, NavLink, RemixContext } from "../components";

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

    it("defaults the port to 8002", () => {
      LiveReload = require("../components").LiveReload;
      let { container } = render(<LiveReload />);
      expect(container.querySelector("script")).toHaveTextContent(
        "url.port = undefined || REMIX_DEV_ORIGIN ? new URL(REMIX_DEV_ORIGIN).port : Number(undefined) || 8002;"
      );
    });

    it("can set the port explicitly", () => {
      let { container } = render(<LiveReload port={4321} />);
      expect(container.querySelector("script")).toHaveTextContent(
        "url.port = 4321 || REMIX_DEV_ORIGIN ? new URL(REMIX_DEV_ORIGIN).port : Number(undefined) || 8002;"
      );
    });

    it("determines the right port based on REMIX_DEV_SERVER_WS_PORT env variable", () => {
      process.env.REMIX_DEV_SERVER_WS_PORT = "1234";
      let { container } = render(<LiveReload />);
      expect(container.querySelector("script")).toHaveTextContent(
        "url.port = undefined || REMIX_DEV_ORIGIN ? new URL(REMIX_DEV_ORIGIN).port : Number(1234) || 8002;"
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
            hasCatchBoundary: false,
            hasErrorBoundary: false,
            id: "idk",
            module: "idk.js",
          },
        },
        entry: { imports: [], module: "" },
        url: "",
        version: "",
      },
      future: { v2_meta: false },
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
