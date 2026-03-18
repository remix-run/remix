export function waitForCssTransition(node, signal, action) {
    return new Promise((resolve) => {
        function finish(event) {
            if (event.target !== node) {
                return;
            }
            node.removeEventListener('transitionend', finish);
            node.removeEventListener('transitioncancel', finish);
            resolve();
        }
        node.addEventListener('transitionend', finish, { signal });
        node.addEventListener('transitioncancel', finish, { signal });
        action();
    });
}
//# sourceMappingURL=wait-for-css-transition.js.map