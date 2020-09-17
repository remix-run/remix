import type { ReactNode } from "react";
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import { EntryContext } from "@remix-run/core";

import { RemixEntryProvider } from "./index";

declare global {
  var __remixContext: EntryContext;
}

// if ('scrollRestoration' in window.history) {
//   window.history.scrollRestoration = 'manual'
// }

export default function RemixBrowser({ children }: { children: ReactNode }) {
  return (
    <Router>
      <RemixEntryProvider context={window.__remixContext} children={children} />
    </Router>
  );
}
