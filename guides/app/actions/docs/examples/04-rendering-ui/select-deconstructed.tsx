import { demoWithCode } from "../demo-with-code.tsx";
import { SelectDeconstructed } from "./select-deconstructed.demo.tsx";

let demoUrl = new URL("./select-deconstructed.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, SelectDeconstructed);
