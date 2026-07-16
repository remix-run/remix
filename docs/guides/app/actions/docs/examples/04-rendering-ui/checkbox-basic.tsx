import { demoWithCode } from "../demo-with-code.tsx";
import { CheckboxBasic } from "./checkbox-basic.demo.tsx";

let demoUrl = new URL("./checkbox-basic.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, CheckboxBasic);
