import { demoWithCode } from "../demo-with-code.tsx";
import { ListboxPrimitives } from "./public/listbox-primitives.demo.tsx";

let demoUrl = new URL("./public/listbox-primitives.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, ListboxPrimitives);
