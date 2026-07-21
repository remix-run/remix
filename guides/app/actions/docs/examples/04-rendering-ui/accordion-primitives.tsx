import { demoWithCode } from "../demo-with-code.tsx";
import { AccordionPrimitives } from "./accordion-primitives.demo.tsx";

let demoUrl = new URL("./accordion-primitives.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, AccordionPrimitives);
