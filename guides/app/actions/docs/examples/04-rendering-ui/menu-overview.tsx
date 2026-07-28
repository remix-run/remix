import { demoWithCode } from "../demo-with-code.tsx";
import { MenuOverview } from "./menu-overview.demo.tsx";

let demoUrl = new URL("./menu-overview.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, MenuOverview);
