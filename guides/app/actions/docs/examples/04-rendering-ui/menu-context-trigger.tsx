import { demoWithCode } from "../demo-with-code.tsx";
import { ContextMenuTrigger } from "./public/menu-context-trigger.demo.tsx";

let demoUrl = new URL(
  "./public/menu-context-trigger.demo.tsx",
  import.meta.url,
);

export const handler = demoWithCode(demoUrl, ContextMenuTrigger);
