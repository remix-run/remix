import type { ReactNode } from "react";
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { EntryContext } from "@remix-run/core";

import { RemixEntryProvider } from "./index";
import { createSuspenseRouteModuleLoader } from "./browserModules";

declare global {
  var __remixContext: EntryContext;
}

// if ('scrollRestoration' in window.history) {
//   window.history.scrollRestoration = 'manual'
// }

let context = window.__remixContext;
let routeLoader = createSuspenseRouteModuleLoader(
  context.browserManifest,
  context.publicPath
);

Object.assign(context, { routeLoader });

export default function RemixBrowser({ children }: { children: ReactNode }) {
  return (
    <Router>
      <RemixEntryProvider context={context} children={children} />
    </Router>
  );
}
