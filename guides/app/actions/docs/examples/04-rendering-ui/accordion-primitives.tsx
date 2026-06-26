import { demoWithCode } from "../demo-with-code.tsx";
import { AccordionPrimitives } from "./public/accordion-primitives.demo.tsx";

let demoUrl = new URL(
  "./public/accordion-primitives.demo.tsx",
  import.meta.url,
);

export const handler = demoWithCode(demoUrl, AccordionPrimitives);
