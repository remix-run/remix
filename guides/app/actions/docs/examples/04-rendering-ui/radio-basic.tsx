import { demoWithCode } from "../demo-with-code.tsx";
import { RadioBasic } from "./public/radio-basic.demo.tsx";

let demoUrl = new URL("./public/radio-basic.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, RadioBasic);
