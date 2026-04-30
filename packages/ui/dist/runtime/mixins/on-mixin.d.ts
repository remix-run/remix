import type { ElementProps } from '../jsx.ts';
import type { MixinDescriptor } from './mixin.ts';
import type { EventType as AddEventType, ListenerFor as AddEventListenerFor } from '../event-listeners.ts';
export type { Dispatched } from '../event-listeners.ts';
type SignaledListener<event extends Event> = (event: event, signal: AbortSignal) => void | Promise<void>;
type EventType<target extends Element> = Extract<AddEventType<target>, string>;
type ListenerFor<target extends Element, type extends EventType<target>> = SignaledListener<Parameters<AddEventListenerFor<target, type>>[0]>;
/**
 * Attaches a typed DOM event handler through the mixin system.
 *
 * @param type Event type to listen for.
 * @param handler Event handler.
 * @param captureBoolean Whether to listen during capture.
 * @returns A mixin descriptor for the target element.
 */
export declare function on<target extends Element = Element, type extends EventType<target> = EventType<target>>(type: type, handler: ListenerFor<target, type>, captureBoolean?: boolean): MixinDescriptor<target, [type, ListenerFor<target, type>, boolean?], ElementProps>;
