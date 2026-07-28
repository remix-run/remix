import { demoWithCode } from "../demo-with-code.tsx";
import { SelectOverview } from "./select-overview.demo.tsx";

let demoUrl = new URL("./select-overview.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, SelectOverview);
