import type { ReactNode } from "react";
import React from "react";
import type { BrowserHistory, Update } from "history";
import { createBrowserHistory } from "history";
import type { ServerHandoff } from "@remix-run/core";

import { RemixEntry } from "./internals";
import type { RouteModuleCache } from "./routeModuleCache";
import { createRouteLoader } from "./routeModuleCache";

declare global {
  var __remixRoutes: RouteModuleCache;
  var __remixServerHandoff: ServerHandoff;
}

// if ("scrollRestoration" in window.history) {
//   window.history.scrollRestoration = "manual";
// }

let serverHandoff = window.__remixServerHandoff;
let browserEntryContext = {
  ...serverHandoff,
  routeLoader: createRouteLoader(window.__remixRoutes, serverHandoff.publicPath)
};

export interface RemixBrowserProps {
  children: ReactNode;
}

export default function RemixBrowser({ children }: RemixBrowserProps) {
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
      children={children}
      context={browserEntryContext}
      action={state.action}
      location={state.location}
      navigator={history}
    />
  );
}
