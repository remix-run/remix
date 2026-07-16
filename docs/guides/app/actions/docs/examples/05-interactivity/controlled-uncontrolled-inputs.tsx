import { demoPreview } from "../demo-with-code.tsx";
import { ControlledUncontrolledInputs } from "./controlled-uncontrolled-inputs.demo.tsx";

let demoUrl = new URL("./controlled-uncontrolled-inputs.demo.tsx", import.meta.url);

export const handler = demoPreview(demoUrl, ControlledUncontrolledInputs);
