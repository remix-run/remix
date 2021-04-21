import ReactDOM from "react-dom";
import { RemixBrowser as Remix } from "@remix-run/react";

// @types/react-dom says the 2nd argument to ReactDOM.hydrate() must be a
// `Element | DocumentFragment | null` but React 16 allows you to pass the
// `document` object as well. This is a bug in @types/react-dom that we can
// safely ignore for now.
// @ts-ignore
ReactDOM.hydrate(<Remix />, document);
