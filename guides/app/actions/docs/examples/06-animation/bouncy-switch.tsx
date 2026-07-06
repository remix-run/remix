import { demoWithCode } from "../demo-with-code.tsx";
import { BouncySwitchDemo } from "./bouncy-switch.demo.tsx";

let demoUrl = new URL("./bouncy-switch.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, BouncySwitchDemo);
