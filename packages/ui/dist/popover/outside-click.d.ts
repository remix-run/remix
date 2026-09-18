type InsideTargetMatcher = (target: Node) => boolean;
declare const onOutsideClick: import("@remix-run/ui").MixinFactory<HTMLElement, [active: boolean, handler: (target: Node | null) => void, isInsideTarget?: InsideTargetMatcher | undefined, stopPropagation?: boolean | undefined], import("@remix-run/ui").ElementProps>;
export { onOutsideClick };
