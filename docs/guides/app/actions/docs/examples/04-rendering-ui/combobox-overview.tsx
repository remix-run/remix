import { demoWithCode } from "../demo-with-code.tsx";
import { ComboboxOverview } from "./combobox-overview.demo.tsx";

let demoUrl = new URL("./combobox-overview.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, ComboboxOverview);
