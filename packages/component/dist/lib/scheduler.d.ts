import type { CommittedComponentNode } from './vnode.ts';
import type { StyleManager } from './style/index.ts';
type EmptyFn = () => void;
type SchedulerPhaseType = 'beforeUpdate' | 'commit';
type SchedulerPhaseListener = EventListenerOrEventListenerObject | null;
export type Scheduler = ReturnType<typeof createScheduler>;
export type SchedulerPhaseEvent = Event & {
    parents: ParentNode[];
};
export declare function createScheduler(doc: Document, rootTarget: EventTarget, styles?: StyleManager): {
    enqueue(vnode: CommittedComponentNode, domParent: ParentNode): void;
    enqueueTasks(newTasks: EmptyFn[]): void;
    addEventListener(type: SchedulerPhaseType, listener: SchedulerPhaseListener, options?: AddEventListenerOptions | boolean): void;
    removeEventListener(type: SchedulerPhaseType, listener: SchedulerPhaseListener, options?: EventListenerOptions | boolean): void;
    dequeue(): void;
};
export {};
