import {
  render as rtlRender,
  RenderOptions,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, RemixBrowser } from "remix";

import LangCombobox from "./lang-combobox";
import { EntryRoute } from "@remix-run/react/routes";
import { setupServer } from "msw/node";
import { rest } from "msw";

const server = setupServer(
  rest.all("http://localhost/*", async (req, res, ctx) => {
    // use this to determine which module to call
    console.log(req.url.searchParams.get("_data"));
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterAll(() => server.close());

function render(
  ui: React.ReactElement,
  {
    routes,
    ...options
  }: RenderOptions & { routes?: Record<string, EntryRoute> } = {}
) {
  function RootComponent() {
    return ui;
  }

  window.location.href = "http://localhost/__test";
  window.__remixManifest = {
    routes: {
      root: {
        hasAction: false,
        hasCatchBoundary: false,
        hasErrorBoundary: false,
        hasLoader: false,
        id: "root",
        imports: [],
        module: "",
        path: "",
      },
      __test: {
        hasAction: false,
        hasCatchBoundary: false,
        hasErrorBoundary: false,
        hasLoader: false,
        id: "__test",
        imports: [],
        module: "",
        path: "/__test",
        parentId: "root",
      },
      ...routes,
    },
    entry: { imports: [], module: "" },
    url: "",
    version: "",
  };
  window.__remixRouteModules = {
    root: { default: () => <Outlet /> },
    __test: { default: RootComponent },
  };
  window.__remixContext = {
    matches: [],
    manifest: window.__remixManifest,
    routeModules: window.__remixRouteModules,
    routeData: {},
    appState: {
      catchBoundaryRouteId: null,
      loaderBoundaryRouteId: null,
      renderBoundaryRouteId: "root",
      trackBoundaries: false,
      trackCatchBoundaries: false,
    },
  };

  return rtlRender(ui, { wrapper: RemixBrowser, ...options });
}

test("LangCombobox", () => {
  render(<LangCombobox />, {
    routes: {
      "routes/lang-search": {
        hasAction: false,
        hasCatchBoundary: false,
        hasErrorBoundary: false,
        hasLoader: true,
        id: "routes/lang-search",
        module: "",
        parentId: "root",
        path: "lang-search",
      },
    },
  });
  userEvent.type(screen.getByLabelText(/lang search/i), "uk");
  screen.debug();
});
