import { demoWithCode } from "../demo-with-code.tsx";
import { AnchorPositioning } from "./public/anchor-positioning.demo.tsx";

let demoUrl = new URL("./public/anchor-positioning.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, AnchorPositioning);
