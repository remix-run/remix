import { createRoot } from "remix/ui";

import { App } from "./app.tsx";

const root = document.body.firstElementChild;
if (!(root instanceof HTMLElement)) throw new Error("Missing root element");

createRoot(root).render(<App />);
