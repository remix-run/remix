export function waitForCssTransition(node, signal, action) {
    return new Promise((resolve) => {
        let resolved = false;
        let sawTransitionRun = false;
        let firstFrameId = 0;
        let secondFrameId = 0;
        function cleanup() {
            cancelAnimationFrame(firstFrameId);
            cancelAnimationFrame(secondFrameId);
            node.removeEventListener('transitionrun', handleTransitionRun);
            node.removeEventListener('transitionend', finish);
            node.removeEventListener('transitioncancel', finish);
            signal.removeEventListener('abort', finish);
        }
        function handleTransitionRun(event) {
            if (event.target !== node) {
                return;
            }
            sawTransitionRun = true;
        }
        function finish(event) {
            if (event instanceof TransitionEvent && event.target !== node) {
                return;
            }
            if (resolved) {
                return;
            }
            resolved = true;
            cleanup();
            resolve();
        }
        node.addEventListener('transitionrun', handleTransitionRun);
        node.addEventListener('transitionend', finish);
        node.addEventListener('transitioncancel', finish);
        signal.addEventListener('abort', finish, { once: true });
        if (action) {
            try {
                action();
            }
            catch (error) {
                cleanup();
                throw error;
            }
        }
        if (signal.aborted) {
            finish();
            return;
        }
        firstFrameId = requestAnimationFrame(() => {
            secondFrameId = requestAnimationFrame(() => {
                if (!sawTransitionRun) {
                    finish();
                }
            });
        });
    });
}
//# sourceMappingURL=wait-for-css-transition.js.map