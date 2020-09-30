import React from "react";
import ReactDOM from "react-dom";
import Remix from "@remix-run/react/browser";

import App from "./components/App";

ReactDOM.unstable_createRoot(document, { hydrate: true }).render(
  <Remix>
    <App />
  </Remix>
);
