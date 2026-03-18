function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
export async function flashAttribute(node, attributeName, duration) {
    await wait(duration);
    node.setAttribute(attributeName, 'true');
    try {
        await wait(duration);
    }
    finally {
        node.removeAttribute(attributeName);
    }
}
//# sourceMappingURL=flash-attribute.js.map