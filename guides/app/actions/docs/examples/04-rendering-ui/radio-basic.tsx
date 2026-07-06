import { demoWithCode } from "../demo-with-code.tsx";
import { RadioBasic } from "./radio-basic.demo.tsx";

let demoUrl = new URL("./radio-basic.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, RadioBasic);
