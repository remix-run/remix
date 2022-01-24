import { hydrate } from "react-dom";
import { RemixBrowser } from "remix";

const documentElement = document.documentElement;
const apply = (n: HTMLElement) => document.replaceChild(n, documentElement);
// Temp fix
hydrate(<RemixBrowser />,  {
	childNodes: [documentElement],
	firstChild: documentElement,
	insertBefore: apply,
	appendChild: apply
})
