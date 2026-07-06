import { demoWithCode } from "../demo-with-code.tsx";
import { ListboxPrimitives } from "./listbox-primitives.demo.tsx";

let demoUrl = new URL("./listbox-primitives.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, ListboxPrimitives);
