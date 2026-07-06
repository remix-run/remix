import { demoWithCode } from "../demo-with-code.tsx";
import { TabsBasic } from "./tabs-basic.demo.tsx";

let demoUrl = new URL("./tabs-basic.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, TabsBasic);
