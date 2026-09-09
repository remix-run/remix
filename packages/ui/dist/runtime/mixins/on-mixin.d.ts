import { type MixinType } from './mixin.ts';
import type { ElementProps } from '../jsx.ts';
import type { MixinDescriptor } from './mixin.ts';
import type { EnsureEvent, EventMap } from '../event-listeners.ts';
type SignaledListener<event extends Event> = (event: event, signal: AbortSignal) => void | Promise<void>;
type EventType<target extends Element> = string & keyof EventMap<target>;
type ListenerFor<target extends Element, type extends EventType<target>> = SignaledListener<EnsureEvent<EventMap<target>[type], target>>;
export type OnMixinDescriptor = {
    type: typeof onMixinType;
    args: [type: string, handler: SignaledListener<Event>, captureBoolean?: boolean];
};
declare const onMixinType: MixinType<Element, [
    type: string,
    handler: SignaledListener<Event>,
    captureBoolean?: boolean
], ElementProps>;
export declare function isOnMixinDescriptor(descriptor: unknown): descriptor is OnMixinDescriptor;
/**
 * Attaches a typed DOM event handler through the mixin system.
 *
 * @param type Event type to listen for.
 * @param handler Event handler.
 * @param captureBoolean Whether to listen during capture.
 * @returns A mixin descriptor for the target element.
 */
export declare function on<target extends Element = Element, type extends EventType<target> = EventType<target>>(type: type, handler: ListenerFor<target, type>, captureBoolean?: boolean): MixinDescriptor<target, [type, ListenerFor<target, type>, boolean?], ElementProps>;
export {};
