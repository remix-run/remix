import { demoWithCode } from "../demo-with-code.tsx";
import { ButtonStates } from "./public/button-states.demo.tsx";

let demoUrl = new URL("./public/button-states.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, ButtonStates);
