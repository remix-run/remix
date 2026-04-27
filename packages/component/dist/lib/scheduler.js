import { createDocumentState } from "./document-state.js";
import { createComponentErrorEvent } from "./error-event.js";
import { isCommittedComponentNode } from "./vnode.js";
import { findNextSiblingDomAnchor, renderComponent, setActiveSchedulerUpdateParents, } from "./reconcile.js";
import { defaultStyleManager } from "./diff-props.js";
// Protect against infinite cascading updates (e.g. handle.update() during render)
const MAX_CASCADING_UPDATES = 50;
/**
 * Creates the DOM update scheduler used by the component runtime.
 *
 * @param doc Document associated with the rendered tree.
 * @param rootTarget Event target that receives runtime errors.
 * @param styles Style manager used during reconciliation.
 * @returns A scheduler instance.
 */
export function createScheduler(doc, rootTarget, styles = defaultStyleManager) {
    let documentState = createDocumentState(doc);
    let scheduled = new Map();
    let workTasks = [];
    let commitPhaseTasks = [];
    let postCommitTasks = [];
    let flushScheduled = false;
    let flushing = false;
    let cascadingUpdateCount = 0;
    let resetScheduled = false;
    let phaseEvents = new EventTarget();
    let scheduler;
    function dispatchError(error) {
        console.error(error);
        rootTarget.dispatchEvent(createComponentErrorEvent(error));
    }
    function scheduleCounterReset() {
        if (resetScheduled)
            return;
        resetScheduled = true;
        // Reset when control returns to the event loop while still allowing
        // microtask-driven flushes in the same turn to count as cascading.
        setTimeout(() => {
            cascadingUpdateCount = 0;
            resetScheduled = false;
        }, 0);
    }
    function getFrameStyleManager(vnode) {
        let runtime = vnode._handle?.frame.$runtime;
        return runtime?.styleManager ?? styles;
    }
    function flush() {
        if (flushing)
            return;
        flushing = true;
        try {
            while (true) {
                flushScheduled = false;
                let batch = new Map(scheduled);
                scheduled.clear();
                let hasWork = batch.size > 0 ||
                    workTasks.length > 0 ||
                    commitPhaseTasks.length > 0 ||
                    postCommitTasks.length > 0;
                if (!hasWork)
                    return;
                cascadingUpdateCount++;
                scheduleCounterReset();
                if (cascadingUpdateCount > MAX_CASCADING_UPDATES) {
                    let error = new Error('handle.update() infinite loop detected');
                    dispatchError(error);
                    return;
                }
                documentState.capture();
                let updateParents = batch.size > 0 ? Array.from(new Set(batch.values())) : [];
                setActiveSchedulerUpdateParents(updateParents);
                dispatchPhaseEvent('beforeUpdate', updateParents);
                if (batch.size > 0) {
                    let vnodes = Array.from(batch);
                    let noScheduledAncestor = new Set();
                    for (let [vnode, domParent] of vnodes) {
                        if (ancestorIsScheduled(vnode, batch, noScheduledAncestor))
                            continue;
                        let handle = vnode._handle;
                        let curr = vnode._content;
                        let vParent = vnode._parent;
                        // Calculate anchor at render time from current vdom position (never stale).
                        // Needed for fragment self-updates that add children - without this, new children
                        // would be appended after siblings. The keyed diff has placement logic, but unkeyed
                        // diff relies on anchor for correct positioning.
                        let anchor = findNextSiblingDomAnchor(vnode, vParent) || undefined;
                        try {
                            let updateStyles = getFrameStyleManager(vnode);
                            renderComponent(handle, curr, vnode, domParent, handle.frame, scheduler, updateStyles, rootTarget, vParent, anchor);
                        }
                        catch (error) {
                            dispatchError(error);
                        }
                    }
                }
                flushTaskQueue(workTasks);
                setActiveSchedulerUpdateParents(undefined);
                // Restore selection before commit-phase lifecycle work so mixins see
                // the final DOM state but still run before commit listeners and user tasks.
                documentState.restore();
                flushTaskQueue(commitPhaseTasks);
                dispatchPhaseEvent('commit', updateParents);
                flushTaskQueue(postCommitTasks);
            }
        }
        finally {
            setActiveSchedulerUpdateParents(undefined);
            flushing = false;
        }
    }
    function dispatchPhaseEvent(type, parents) {
        let event = new Event(type);
        event.parents = parents;
        phaseEvents.dispatchEvent(event);
    }
    function flushTaskQueue(queue) {
        while (queue.length > 0) {
            let task = queue.shift();
            if (!task)
                continue;
            try {
                task();
            }
            catch (error) {
                dispatchError(error);
            }
        }
    }
    function scheduleFlush() {
        if (flushScheduled || flushing)
            return;
        flushScheduled = true;
        queueMicrotask(flush);
    }
    function ancestorIsScheduled(vnode, batch, safe) {
        let path = [];
        let current = vnode._parent;
        while (current) {
            // Already verified this node has no scheduled ancestor above it
            if (safe.has(current)) {
                for (let node of path)
                    safe.add(node);
                return false;
            }
            path.push(current);
            if (isCommittedComponentNode(current) && batch.has(current)) {
                return true;
            }
            current = current._parent;
        }
        // Reached root - mark entire path as safe for future lookups
        for (let node of path)
            safe.add(node);
        return false;
    }
    scheduler = {
        enqueue(vnode, domParent) {
            scheduled.set(vnode, domParent);
            scheduleFlush();
        },
        enqueueWork(newTasks) {
            workTasks.push(...newTasks);
            scheduleFlush();
        },
        enqueueCommitPhase(newTasks) {
            commitPhaseTasks.push(...newTasks);
            scheduleFlush();
        },
        enqueueTasks(newTasks) {
            postCommitTasks.push(...newTasks);
            scheduleFlush();
        },
        addEventListener(type, listener, options) {
            phaseEvents.addEventListener(type, listener, options);
        },
        removeEventListener(type, listener, options) {
            phaseEvents.removeEventListener(type, listener, options);
        },
        dequeue() {
            flush();
        },
    };
    return scheduler;
}
//# sourceMappingURL=scheduler.js.map