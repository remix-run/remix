import type { ReactElement, ReactNode } from "react";
import React from "react";
import type { BrowserHistory, Update } from "history";
import { createBrowserHistory } from "history";
import type { EntryContext } from "@remix-run/core";
import type { ErrorBoundaryComponent } from "@remix-run/core";

import { RemixEntry } from "./components";
import type { RouteModules } from "./routeModules";

declare global {
  var __remixContext: EntryContext;
  var __remixRouteModules: RouteModules;
}

// if ("scrollRestoration" in window.history) {
//   window.history.scrollRestoration = "manual";
// }

export interface RemixBrowserProps {
  children: ReactNode;
  ErrorBoundary?: ErrorBoundaryComponent;
}

/**
 * The entry point for a Remix app when it is rendered in the browser (in
 * `entry-browser.js`). This component is used by React to hydrate the HTML
 * that was received from the server.
 */
export default function RemixBrowser({
  children,
  ErrorBoundary
}: RemixBrowserProps): ReactElement {
  let historyRef = React.useRef<BrowserHistory>();
  if (historyRef.current == null) {
    historyRef.current = createBrowserHistory({ window });
  }

  let history = historyRef.current;
  let [state, dispatch] = React.useReducer(
    (_: Update, update: Update) => update,
    {
      action: history.action,
      location: history.location
    }
  );

  React.useLayoutEffect(() => history.listen(dispatch), [history]);

  let entryContext = window.__remixContext;
  entryContext.routeModules = window.__remixRouteModules;
  // In the browser, we don't need this because a) in the case of loader
  // errors we already know the order and b) in the case of render errors
  // React knows the order and handles error boundaries normally.
  entryContext.componentDidCatchEmulator.trackBoundaries = false;

  return (
    <RemixEntry
      children={children}
      context={entryContext}
      action={state.action}
      location={state.location}
      navigator={history}
      ErrorBoundary={ErrorBoundary}
    />
  );
}
