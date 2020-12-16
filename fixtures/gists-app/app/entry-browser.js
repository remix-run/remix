import ReactDOM from "react-dom";
import Remix from "@remix-run/react/browser";

import App, { ErrorBoundary } from "./App";

ReactDOM.hydrate(
  <Remix ErrorBoundary={ErrorBoundary}>
    <App />
  </Remix>,
  document
);
