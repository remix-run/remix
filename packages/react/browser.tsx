import type { ReactNode } from "react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import { EntryContext } from "@remix-run/core";

import { RemixEntry } from "./index";
import { createRouteLoader } from "./browserModules";

declare global {
  var __remixContext: EntryContext;
}

// if ('scrollRestoration' in window.history) {
//   window.history.scrollRestoration = 'manual'
// }

let context = window.__remixContext;
let routeLoader = createRouteLoader(context.publicPath);

export default function RemixBrowser({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter timeoutMs={20000}>
      <RemixEntry context={{ ...context, routeLoader }} children={children} />
    </BrowserRouter>
  );
}
