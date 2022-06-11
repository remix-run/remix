/// <reference no-default-lib="true" />
/// <reference lib="dom" />

import { RemixBrowser } from "@remix-run/react";
import * as React from "react";
import { hydrate } from "react-dom";

hydrate(<RemixBrowser />, document);
