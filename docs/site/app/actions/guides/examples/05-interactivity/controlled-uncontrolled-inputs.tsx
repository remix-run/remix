import { demoPreview } from "../demo-with-code.tsx";
import { ControlledUncontrolledInputs } from "./public/controlled-uncontrolled-inputs.demo.tsx";

let demoUrl = new URL("./public/controlled-uncontrolled-inputs.demo.tsx", import.meta.url);

export const handler = demoPreview(demoUrl, ControlledUncontrolledInputs);
