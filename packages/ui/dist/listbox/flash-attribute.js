function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
export async function flashAttribute(node, attributeName, duration) {
    node.setAttribute(attributeName, 'true');
    await wait(duration);
    node.removeAttribute(attributeName);
}
//# sourceMappingURL=flash-attribute.js.map