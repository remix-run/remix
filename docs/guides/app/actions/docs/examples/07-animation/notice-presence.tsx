import { demoWithCode } from "../demo-with-code.tsx";
import { NoticePresenceDemo } from "./public/notice-presence.demo.tsx";

let demoUrl = new URL("./public/notice-presence.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, NoticePresenceDemo);
