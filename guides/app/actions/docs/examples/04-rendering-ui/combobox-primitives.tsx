import { demoWithCode } from "../demo-with-code.tsx";
import { ComboboxPrimitives } from "./combobox-primitives.demo.tsx";

let demoUrl = new URL("./combobox-primitives.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, ComboboxPrimitives);
