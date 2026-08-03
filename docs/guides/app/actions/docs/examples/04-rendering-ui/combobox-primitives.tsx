import { demoWithCode } from "../demo-with-code.tsx";
import { ComboboxPrimitives } from "./public/combobox-primitives.demo.tsx";

let demoUrl = new URL("./public/combobox-primitives.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, ComboboxPrimitives);
