import { RemixBrowser } from "@remix-run/react";
import { hydrate } from "react-dom";

import { setupTwind } from "./twind";

setupTwind();
hydrate(<RemixBrowser />, document);
