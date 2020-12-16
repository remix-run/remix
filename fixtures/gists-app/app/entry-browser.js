import ReactDOM from "react-dom";
import Remix from "@remix-run/react/browser";

import App, { UncaughtException } from "./App";

ReactDOM.hydrate(
  <Remix UncaughtException={UncaughtException}>
    <App />
  </Remix>,
  document
);
