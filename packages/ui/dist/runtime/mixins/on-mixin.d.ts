import type { ElementProps } from '../jsx.ts';
import type { MixinDescriptor } from './mixin.ts';
import type { EventType as AddEventType, ListenerFor as AddEventListenerFor } from '../event-listeners.ts';
export type { Dispatched } from '../event-listeners.ts';
type SignaledListener<event extends Event> = (event: event, signal: AbortSignal) => void | Promise<void>;
type EventType<target extends Element> = Extract<AddEventType<target>, string>;
type ListenerFor<target extends Element, type extends EventType<target>> = SignaledListener<Parameters<AddEventListenerFor<target, type>>[0]>;
type OnTuple<target extends Element, type extends EventType<target>> = [
    type: type,
    handler: ListenerFor<target, type>,
    captureBoolean?: boolean
];
type OnArgs<target extends Element> = {
    [type in EventType<target>]: OnTuple<target, type>;
}[EventType<target>];
/**
 * Attaches a typed DOM event handler through the mixin system.
 *
 * @param type Event type to listen for.
 * @param handler Event handler.
 * @param captureBoolean Whether to listen during capture.
 * @returns A mixin descriptor for the target element.
 */
export declare function on<target extends Element, type extends EventType<target>>(...args: OnTuple<target, type>): MixinDescriptor<target, OnTuple<target, type>, ElementProps>;
export declare function on<target extends Element>(...args: OnArgs<target>): MixinDescriptor<target, OnArgs<target>, ElementProps>;
