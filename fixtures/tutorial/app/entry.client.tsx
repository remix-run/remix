import ReactDOM from "react-dom";
import { RemixBrowser } from "remix";

// @ts-expect-error
ReactDOM.hydrate(<RemixBrowser />, document);
