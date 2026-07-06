import { demoWithCode } from "../demo-with-code.tsx";
import { ComponentModelDemo } from "./component-model.demo.tsx";

let demoUrl = new URL("./component-model.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, ComponentModelDemo);
