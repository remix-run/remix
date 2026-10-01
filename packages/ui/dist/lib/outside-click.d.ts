type InsideTargetMatcher = (target: Node) => boolean;
declare const onOutsideClick: import("@remix-run/component").MixinFactory<HTMLElement, [active: boolean, handler: (target: Node | null) => void, isInsideTarget?: InsideTargetMatcher | undefined, stopPropagation?: boolean | undefined], import("@remix-run/component").ElementProps>;
export { onOutsideClick };
