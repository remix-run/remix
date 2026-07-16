import { demoWithCode } from "../demo-with-code.tsx";
import { PressStateDemo } from "./press-state.demo.tsx";

let demoUrl = new URL("./press-state.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, PressStateDemo);
