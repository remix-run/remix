import type { CommittedComponentNode } from './vnode.ts';
import type { StyleManager } from './style/index.ts';
type EmptyFn = () => void;
type SchedulerPhaseType = 'beforeUpdate' | 'commit';
type SchedulerPhaseListener = EventListenerOrEventListenerObject | null;
/**
 * Scheduler API used by the reconciler and frame runtime.
 */
export type Scheduler = ReturnType<typeof createScheduler>;
export type SchedulerPhaseEvent = Event & {
    parents: ParentNode[];
};
/**
 * Creates the DOM update scheduler used by the component runtime.
 *
 * @param doc Document associated with the rendered tree.
 * @param rootTarget Event target that receives runtime errors.
 * @param styles Style manager used during reconciliation.
 * @returns A scheduler instance.
 */
export declare function createScheduler(doc: Document, rootTarget: EventTarget, styles?: StyleManager): {
    enqueue(vnode: CommittedComponentNode, domParent: ParentNode): void;
    enqueueWork(newTasks: EmptyFn[]): void;
    enqueueCommitPhase(newTasks: EmptyFn[]): void;
    enqueueTasks(newTasks: EmptyFn[]): void;
    addEventListener(type: SchedulerPhaseType, listener: SchedulerPhaseListener, options?: AddEventListenerOptions | boolean): void;
    removeEventListener(type: SchedulerPhaseType, listener: SchedulerPhaseListener, options?: EventListenerOptions | boolean): void;
    dequeue(): void;
};
export {};
