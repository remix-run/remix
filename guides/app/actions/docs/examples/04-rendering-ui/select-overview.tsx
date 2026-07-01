import { demoWithCode } from "../demo-with-code.tsx";
import { SelectOverview } from "./public/select-overview.demo.tsx";

let demoUrl = new URL("./public/select-overview.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, SelectOverview);
