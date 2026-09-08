import { demoWithCode } from "../demo-with-code.tsx";
import { TabsBasic } from "./public/tabs-basic.demo.tsx";

let demoUrl = new URL("./public/tabs-basic.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, TabsBasic);
