import { demoWithCode } from "../demo-with-code.tsx";
import { InputBasic } from "./public/input-basic.demo.tsx";

let demoUrl = new URL("./public/input-basic.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, InputBasic);
