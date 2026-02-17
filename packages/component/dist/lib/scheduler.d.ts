import type { CommittedComponentNode } from './vnode.ts';
import type { StyleManager } from './style/index.ts';
type EmptyFn = () => void;
export type Scheduler = ReturnType<typeof createScheduler>;
export declare function createScheduler(doc: Document, rootTarget: EventTarget, styles?: StyleManager): {
    enqueue(vnode: CommittedComponentNode, domParent: ParentNode): void;
    enqueueTasks(newTasks: EmptyFn[]): void;
    dequeue(): void;
};
export {};
