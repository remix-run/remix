import type { ReactNode } from "react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import type { EntryContext } from "@remix-run/core";

import { RemixEntry } from "./index";
import { createRouteLoader } from "./routeModuleCache";

declare global {
  var __remixContext: EntryContext;
}

// if ('scrollRestoration' in window.history) {
//   window.history.scrollRestoration = 'manual'
// }

let serverHandoff = window.__remixContext;
let browserEntryContext = {
  ...serverHandoff,
  routeLoader: createRouteLoader(serverHandoff.publicPath)
};

export default function RemixBrowser({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter timeoutMs={20000}>
      <RemixEntry context={browserEntryContext} children={children} />
    </BrowserRouter>
  );
}
