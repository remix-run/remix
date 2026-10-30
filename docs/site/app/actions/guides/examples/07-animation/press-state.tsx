import { demoWithCode } from "../demo-with-code.tsx";
import { PressStateDemo } from "./public/press-state.demo.tsx";

let demoUrl = new URL("./public/press-state.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, PressStateDemo);
