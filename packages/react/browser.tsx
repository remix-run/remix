import type { ReactNode } from "react";
import React from "react";
import type { BrowserHistory, Update } from "history";
import { createBrowserHistory } from "history";
import type { EntryContext } from "@remix-run/core";

import { RemixEntry } from "./internals";
import type { RouteModuleCache } from "./routeModuleCache";
import { createRouteLoader } from "./routeModuleCache";

declare global {
  var __remixContext: EntryContext;
  var __remixRoutes: RouteModuleCache;
}

// if ("scrollRestoration" in window.history) {
//   window.history.scrollRestoration = "manual";
// }

let serverHandoff = window.__remixContext;
let browserEntryContext = {
  ...serverHandoff,
  routeLoader: createRouteLoader(window.__remixRoutes, serverHandoff.publicPath)
};

export default function RemixBrowser({ children }: { children: ReactNode }) {
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

  return (
    <RemixEntry
      context={browserEntryContext}
      children={children}
      action={state.action}
      location={state.location}
      navigator={history}
    />
  );
}
