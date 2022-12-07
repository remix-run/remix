import * as React from "react";
import { MemoryRouter, Outlet } from "react-router-dom";
import { render, screen } from "@testing-library/react";

import { LiveReload, RemixEntryContext, Scripts } from "../components";
import type { RemixEntryContextType } from "../components";
import { ScrollRestoration } from "../scroll-restoration";

import "@testing-library/jest-dom/extend-expect";

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <React.Fragment>
      <Outlet />
      {children}
      <Scripts />
      <LiveReload />
    </React.Fragment>
  );
}

describe("<ScrollRestoration />", () => {
  function withContext(stuff: JSX.Element) {
    let context: RemixEntryContextType = {
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
        {
          id: "idk",
          path: "idk",
          hasLoader: true,
          element: "",
          module: "",
          async action() {
            return {};
          },
          async loader() {
            return {};
          },
        },
      ],
      routeData: {},
      appState: {} as any,
      transitionManager: {
        getState() {
          return {
            transition: {},
          };
        },
      } as any,
    };
    return (
      <RemixEntryContext.Provider value={context}>
        <MemoryRouter>{stuff}</MemoryRouter>
      </RemixEntryContext.Provider>
    );
  }

  it("should render a <script> tag", () => {
    render(
      withContext(
        <AppShell>
          <ScrollRestoration data-testid="scroll-script" />
        </AppShell>
      )
    );
    let script = screen.getByTestId("scroll-script");
    expect(script instanceof HTMLScriptElement).toBe(true);
  });

  it("should pass props to <script>", () => {
    render(
      withContext(
        <AppShell>
          <ScrollRestoration
            data-testid="scroll-script"
            nonce="hello"
            crossOrigin="anonymous"
          />
        </AppShell>
      )
    );
    let script = screen.getByTestId("scroll-script");
    expect(script).toHaveAttribute("nonce", "hello");
    expect(script).toHaveAttribute("crossorigin", "anonymous");
  });

  it.todo("should restore scroll position");
});
