import { demoWithCode } from "../demo-with-code.tsx";
import { StylingCardDemo } from "./public/styling-card.demo.tsx";

let demoUrl = new URL("./public/styling-card.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, StylingCardDemo);
