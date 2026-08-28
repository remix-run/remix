import { demoWithCode } from "../demo-with-code.tsx";
import { PopoverBasic } from "./public/popover-basic.demo.tsx";

let demoUrl = new URL("./public/popover-basic.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, PopoverBasic);
