import React from "react";
import { unstable_createRoot as createRoot } from "react-dom";
import App from "./components/App";
import Remix from "remix/dom";

createRoot(document, { hydrate: true }).render(
  <Remix>
    <App />
  </Remix>
);
