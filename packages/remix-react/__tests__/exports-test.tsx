import * as ReactRouterDOM from "react-router-dom";
import * as RemixReact from "@remix-run/react";

let nonReExportedKeys = new Set([
  // Internal error used by Remix
  "AbortedDeferredError",
  // Remix manages the router for you, so we don't re-export these
  "BrowserRouter",
  "HashRouter",
  "MemoryRouter",
  "Router",
  "RouterProvider",
  "createBrowserRouter",
  "createHashRouter",
  "createMemoryRouter",
  // Don't re-export unsafe APIs
  "unstable_HistoryRouter",
  "UNSAFE_DataRouterContext",
  "UNSAFE_DataRouterStateContext",
  "UNSAFE_ErrorResponseImpl",
  "UNSAFE_FetchersContext",
  "UNSAFE_LocationContext",
  "UNSAFE_NavigationContext",
  "UNSAFE_RouteContext",
  "UNSAFE_ViewTransitionContext",
  "UNSAFE_useRouteId",
  "UNSAFE_useScrollRestoration",
]);

// Eventually we should im to get these all aligned so we can
// `export * from react-router-dom`.  Most of the differences are Remix-specific
// type safety, plus Link/NavLink have wrappers to support prefetching
let modifiedExports = new Set([
  "Await", // types
  "Link", // remix-specific prefetching loigc
  "NavLink", // remix-specific prefetching loigc
  "ScrollRestoration", // remix-specific SSR restoration logic
  "defer", // types
  "json", // types
  "redirect", // types
  "redirectDocument", // types
  "useActionData", // types
  "useFetcher", // types
  "useLoaderData", // types
  "useMatches", // types
  "useRouteLoaderData", // types
]);

describe("re-exports from react-router-dom", () => {
  for (let key in ReactRouterDOM) {
    if (nonReExportedKeys.has(key)) {
      it(`does not re-export ${key} from react-router`, () => {
        expect(RemixReact[key] === undefined).toBe(true);
      });
    } else if (modifiedExports.has(key)) {
      it(`re-exports a different version of ${key}`, () => {
        expect(RemixReact[key] !== undefined).toBe(true);
        expect(RemixReact[key] !== ReactRouterDOM[key]).toBe(true);
      });
    } else {
      it(`re-exports ${key} from react-router`, () => {
        expect(RemixReact[key] === ReactRouterDOM[key]).toBe(true);
      });
    }
  }
});
