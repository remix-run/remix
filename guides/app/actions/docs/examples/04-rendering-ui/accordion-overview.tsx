import { demoWithCode } from "../demo-with-code.tsx";
import { AccordionOverview } from "./public/accordion-overview.demo.tsx";

let demoUrl = new URL("./public/accordion-overview.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, AccordionOverview);
