/**
 * Event type with `currentTarget` narrowed to the dispatched target.
 */
export type Dispatched<event extends Event, target extends EventTarget> = Omit<event, 'currentTarget'> & {
    currentTarget: target;
};
/**
 * Narrows non-event values to `never` and preserves dispatched event typing otherwise.
 */
export type EnsureEvent<event, target extends EventTarget> = event extends Event ? Dispatched<event, target> : never;
/**
 * Event map resolved for a DOM element.
 */
export type EventMap<target extends Element> = target extends HTMLElement ? HTMLElementEventMap : target extends SVGSVGElement ? SVGSVGElementEventMap : target extends SVGElement ? SVGElementEventMap : ElementEventMap;
