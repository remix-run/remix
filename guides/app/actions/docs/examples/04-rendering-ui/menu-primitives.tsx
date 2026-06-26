import { demoWithCode } from "../demo-with-code.tsx";
import { MenuPrimitives } from "./public/menu-primitives.demo.tsx";

let demoUrl = new URL("./public/menu-primitives.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, MenuPrimitives);
