import * as React from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, act } from "@testing-library/react";

import type { LiveReload as ActualLiveReload } from "../components";
import { Link, NavLink, RemixEntryContext } from "../components";

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
        `8002 + "/socket"`
      );
    });

    it("can set the port explicitly", () => {
      let { container } = render(<LiveReload port={4321} />);
      expect(container.querySelector("script")).toHaveTextContent(
        `4321 + "/socket"`
      );
    });

    it("determines the right port based on REMIX_DEV_SERVER_WS_PORT env variable", () => {
      process.env.REMIX_DEV_SERVER_WS_PORT = "1234";
      let { container } = render(<LiveReload />);
      expect(container.querySelector("script")).toHaveTextContent(
        `1234 + "/socket"`
      );
    });

    it("timeout of reload is set to 200ms", () => {
      LiveReload = require("../components").LiveReload;
      let { container } = render(<LiveReload timeout={200} />);
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
    beforeEach(() => {
      jest.useFakeTimers();
    });

    function withContext(stuff: JSX.Element) {
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
              module: "idk",
            },
          },
          entry: { imports: [], module: "" },
          url: "",
          version: "",
        },
        matches: [],
        clientRoutes: [
          { id: "idk", path: "idk", hasLoader: true, element: "", module: "" },
        ],
        routeData: {},
        appState: {} as any,
        transitionManager: {} as any,
      };
      return (
        <RemixEntryContext.Provider value={context}>
          <MemoryRouter>{stuff}</MemoryRouter>
        </RemixEntryContext.Provider>
      );
    }

    setIntentEvents.forEach((event) => {
      it(`prefetches page links on ${event}`, () => {
        let { container, unmount } = render(
          withContext(
            <Component {...({ to: "idk", prefetch: "intent" } as Props)} />
          )
        );

        fireEvent[event](container.firstChild);
        act(() => {
          jest.runAllTimers();
        });

        expect(container.querySelector("link[rel=prefetch]")).toBeTruthy();
        unmount();
      });

      it(`prefetches page links and calls explicit handler on ${event}`, () => {
        let ranHandler = false;
        let eventHandler = `on${event[0].toUpperCase()}${event.slice(1)}`;
        let { container, unmount } = render(
          withContext(
            <Component
              {...({
                to: "idk",
                prefetch: "intent",
                [eventHandler]: () => {
                  ranHandler = true;
                },
              } as any)}
            />
          )
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
