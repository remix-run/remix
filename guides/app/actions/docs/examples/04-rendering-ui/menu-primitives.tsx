import { demoWithCode } from "../demo-with-code.tsx";
import { MenuPrimitives } from "./menu-primitives.demo.tsx";

let demoUrl = new URL("./menu-primitives.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, MenuPrimitives);
