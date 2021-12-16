import type { BrowserHistory, Update } from "history";
import { createBrowserHistory } from "history";
import type { ReactElement } from "react";
import React from "react";

import { RemixEntry } from "./components";
import type { EntryContext } from "./entry";
import type { RouteModules } from "./routeModules";

declare global {
  var __remixContext: EntryContext;
  var __remixRouteModules: RouteModules;
  var __remixManifest: EntryContext["manifest"];
}

export interface RemixBrowserProps {}

/**
 * The entry point for a Remix app when it is rendered in the browser (in
 * `app/entry.client.js`). This component is used by React to hydrate the HTML
 * that was received from the server.
 */
export function RemixBrowser(_props: RemixBrowserProps): ReactElement {
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
  entryContext.manifest = window.__remixManifest;
  entryContext.routeModules = window.__remixRouteModules;
  // In the browser, we don't need this because a) in the case of loader
  // errors we already know the order and b) in the case of render errors
  // React knows the order and handles error boundaries normally.
  entryContext.appState.trackBoundaries = false;
  entryContext.appState.trackCatchBoundaries = false;

  return (
    <RemixEntry
      context={entryContext}
      action={state.action}
      location={state.location}
      navigator={history}
    />
  );
}
