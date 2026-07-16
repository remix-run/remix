import { demoWithCode } from "../demo-with-code.tsx";
import { AnimationGallery } from "./animation-gallery.demo.tsx";

let demoUrl = new URL("./animation-gallery.demo.tsx", import.meta.url);

export const handler = demoWithCode(demoUrl, AnimationGallery);
