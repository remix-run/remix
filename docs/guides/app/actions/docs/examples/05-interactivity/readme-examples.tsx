import { demoWithCode } from "../demo-with-code.tsx";
import { DemoApp } from "./readme-examples.demo.tsx";

let demoUrl = new URL("./readme-examples.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, DemoApp);
