import type { EventListeners } from '@remix-run/interaction';
import type { ElementProps, ElementType, RemixNode, Renderable } from './jsx.ts';
export type Task = (signal: AbortSignal) => void;
export interface Handle<C = Record<string, never>> {
    /**
     * Stable identifier per component instance. Useful for HTML APIs like
     * htmlFor, aria-owns, etc. so consumers don't have to supply an id.
     */
    id: string;
    /**
     * Set and get values in an element tree for indirect ancestor/descendant
     * communication.
     */
    context: Context<C>;
    /**
     * Schedules an update for the component to render again.
     *
     * @param task A render task to run after the update completes
     */
    update(task?: Task): void;
    /**
     * Schedules a task to run after the next update.
     *
     * @param task
     */
    queueTask(task: Task): void;
    /**
     * The component's closest frame
     */
    frame: FrameHandle;
    /**
     * A signal indicating the connected status of the component. When the
     * component is disconnected from the tree the signal will be aborted.
     * Useful for setup scope cleanup.
     *
     * @example Clear a timer
     * ```ts
     * function Clock(handle: Handle) {
     *   let interval = setInterval(() => {
     *     if (handle.signal.aborted) {
     *       clearInterval(interval)
     *       return
     *     }
     *     handle.update()
     *   }, 1000)
     *   return () => <span>{new Date().toString()}</span>
     * }
     * ```
     *
     * Because signals are event targets, you can also add an event instead.
     * ```ts
     * function Clock(handle: Handle) {
     *   let interval = setInterval(handle.update)
     *   handle.signal.addEventListener("abort", () => clearInterval(interval))
     *   return () => <span>{new Date().toString()}</span>
     * }
     * ```
     *
     * You don't need to check both this.signal and a render/event signal as
     * render/event signals are aborted when the component disconnects.
     */
    signal: AbortSignal;
    /**
     * Listen to an event target with automatic cleanup when the component is
     * disconnected. Ideal for listening to events on global event targets like
     * document and window (or any other event target that is reachable outside of
     * the component scope).
     *
     * @example
     * ```ts
     * function SomeComp(handle: Handle) {
     *   let keys = []
     *   handle.on(document, {
     *     keydown: (event) => {
     *       keys.push(event.key)
     *       handle.update()
     *     },
     *   })
     *   return () => <span>{keys.join(', ')}</span>
     * }
     * ```
     */
    on: <target extends EventTarget>(target: target, listeners: EventListeners<target>) => void;
}
/**
 * Default Handle context so types must be declared explicitly.
 */
export type NoContext = Record<string, never>;
export type Component<Context = NoContext, Setup = undefined, Props = ElementProps> = (handle: Handle<Context>, setup: Setup) => (props: Props) => RemixNode;
export type ContextFrom<ComponentType> = ComponentType extends Component<infer Provided, any, any> ? Provided : ComponentType extends (handle: Handle<infer Provided>, ...args: any[]) => any ? Provided : never;
export interface Context<C> {
    set(values: C): void;
    get<ComponentType>(component: ComponentType): ContextFrom<ComponentType>;
    get(component: ElementType | symbol): unknown | undefined;
}
export type FrameContent = DocumentFragment | string;
export type FrameHandle = EventTarget & {
    reload(): Promise<void>;
    replace(content: FrameContent): Promise<void>;
};
export interface FrameProps {
    name?: string;
    src: string;
    fallback?: Renderable;
    on?: EventListeners;
}
export type ComponentFn<Context = NoContext, Setup = undefined, Props = Record<string, never>> = (handle: Handle<Context>, setup: Setup) => RenderFn<Props>;
export type RenderFn<P = {}> = (props: P) => RemixNode;
export type { RemixNode } from './jsx.ts';
export interface FragmentProps {
    children?: RemixNode;
}
export interface BuiltinElements {
    Fragment: FragmentProps;
    Frame: FrameProps;
}
export type Key = string | number | bigint;
type ComponentConfig = {
    id: string;
    type: Function;
    frame: FrameHandle;
    getContext: (type: Component) => unknown;
};
export type ComponentHandle = ReturnType<typeof createComponent>;
export declare function createComponent<C = NoContext>(config: ComponentConfig): {
    render: (props: ElementProps) => [RemixNode, Array<() => void>];
    remove: () => (() => void)[];
    setScheduleUpdate: (_scheduleUpdate: (task?: Task) => void) => void;
    frame: FrameHandle;
    getContextValue: () => C | undefined;
};
export declare function Frame(handle: Handle<FrameHandle>): (_: FrameProps) => null;
export declare function Fragment(): (_: FragmentProps) => null;
export declare function createFrameHandle(def?: Partial<{
    src: string;
    replace: FrameHandle['replace'];
    reload: FrameHandle['reload'];
}>): FrameHandle;
