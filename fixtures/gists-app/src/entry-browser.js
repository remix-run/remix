import React from "react";
import { unstable_createRoot as createRoot } from "react-dom";
import Remix from "@remix-run/react/browser";

import App from "./components/App";

createRoot(document, { hydrate: true }).render(
  <Remix>
    <App />
  </Remix>
);
