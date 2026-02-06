import type { CommittedComponentNode } from './vnode.ts';
type EmptyFn = () => void;
export type Scheduler = ReturnType<typeof createScheduler>;
export declare function createScheduler(doc: Document, rootTarget: EventTarget): {
    enqueue(vnode: CommittedComponentNode, domParent: ParentNode): void;
    enqueueTasks(newTasks: EmptyFn[]): void;
    dequeue(): void;
};
export {};
