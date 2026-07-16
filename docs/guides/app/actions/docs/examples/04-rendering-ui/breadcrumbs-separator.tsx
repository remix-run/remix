import { demoWithCode } from "../demo-with-code.tsx";
import { BreadcrumbsSeparator } from "./breadcrumbs-separator.demo.tsx";

let demoUrl = new URL("./breadcrumbs-separator.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, BreadcrumbsSeparator);
