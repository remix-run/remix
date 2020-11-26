import ReactDOM from "react-dom";
import Remix from "@remix-run/react/browser";

import App from "./components/App";

ReactDOM.hydrate(
  <Remix>
    <App />
  </Remix>,
  document
);
