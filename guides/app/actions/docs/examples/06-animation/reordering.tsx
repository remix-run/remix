import { demoWithCode } from "../demo-with-code.tsx";
import { ReorderingDemo } from "./reordering.demo.tsx";

let demoUrl = new URL("./reordering.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, ReorderingDemo);
