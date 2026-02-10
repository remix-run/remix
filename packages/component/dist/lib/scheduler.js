import { createDocumentState } from "./document-state.js";
import { applyLayoutAnimations, captureLayoutSnapshots, markLayoutSubtreePending, } from "./layout-animation.js";
import { isCommittedComponentNode } from "./vnode.js";
import { findNextSiblingDomAnchor, renderComponent } from "./reconcile.js";
export function createScheduler(doc, rootTarget) {
    let documentState = createDocumentState(doc);
    let scheduled = new Map();
    let tasks = [];
    let flushScheduled = false;
    let scheduler;
    function dispatchError(error) {
        console.error(error);
        rootTarget.dispatchEvent(new ErrorEvent('error', { error }));
    }
    function flush() {
        flushScheduled = false;
        let batch = new Map(scheduled);
        scheduled.clear();
        let hasWork = batch.size > 0 || tasks.length > 0;
        if (!hasWork)
            return;
        // Mark layout elements within updating components as pending BEFORE capture
        // This ensures we only capture/apply for elements whose components are updating
        if (batch.size > 0) {
            for (let [, domParent] of batch) {
                markLayoutSubtreePending(domParent);
            }
        }
        // Capture layout snapshots BEFORE any DOM work (for FLIP animations)
        captureLayoutSnapshots();
        documentState.capture();
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
                    renderComponent(handle, curr, vnode, domParent, handle.frame, scheduler, rootTarget, vParent, anchor);
                }
                catch (error) {
                    dispatchError(error);
                }
            }
        }
        // restore before user tasks so users can move focus/selection etc.
        documentState.restore();
        // Apply FLIP layout animations AFTER DOM work, BEFORE user tasks
        applyLayoutAnimations();
        if (tasks.length > 0) {
            for (let task of tasks) {
                try {
                    task();
                }
                catch (error) {
                    dispatchError(error);
                }
            }
            tasks = [];
        }
    }
    function scheduleFlush() {
        if (flushScheduled)
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
        enqueueTasks(newTasks) {
            tasks.push(...newTasks);
            scheduleFlush();
        },
        dequeue() {
            flush();
        },
    };
    return scheduler;
}
//# sourceMappingURL=scheduler.js.map