import { demoWithCode } from "../demo-with-code.tsx";
import { Counter } from "./public/counter.demo.tsx";

let demoUrl = new URL("./public/counter.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, Counter);
