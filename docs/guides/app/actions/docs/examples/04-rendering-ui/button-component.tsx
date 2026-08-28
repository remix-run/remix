import { demoWithCode } from "../demo-with-code.tsx";
import { ButtonComponent } from "./public/button-component.demo.tsx";

let demoUrl = new URL("./public/button-component.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, ButtonComponent);
