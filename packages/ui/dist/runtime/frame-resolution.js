export async function unwrapFrameResolution(resolution) {
    if (!(resolution instanceof Response))
        return { content: resolution };
    let content = resolution.body ?? (await resolution.text());
    return {
        content,
        redirectedTo: resolution.redirected && resolution.url ? resolution.url : undefined,
    };
}
//# sourceMappingURL=frame-resolution.js.map