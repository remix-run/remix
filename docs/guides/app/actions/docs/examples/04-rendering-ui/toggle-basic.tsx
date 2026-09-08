import { demoWithCode } from "../demo-with-code.tsx";
import { ToggleBasic } from "./public/toggle-basic.demo.tsx";

let demoUrl = new URL("./public/toggle-basic.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, ToggleBasic);
