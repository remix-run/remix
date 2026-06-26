import { demoWithCode } from "../demo-with-code.tsx";
import { BasicCounter } from "./public/basic-counter.demo.tsx";

let demoUrl = new URL("./public/basic-counter.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, BasicCounter);
