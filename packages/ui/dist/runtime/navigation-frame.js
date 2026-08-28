export async function reloadNavigationFrame(destination, state, signal, submission, options) {
    let topFrame = options.getTopFrame();
    let namedFrame = state.target ? options.getNamedFrame(state.target) : undefined;
    let frame = namedFrame ?? topFrame;
    topFrame.src = destination;
    if (frame !== topFrame)
        frame.src = state.src;
    let { redirectedTo } = await options.reloadFrame(frame, { ...submission, signal });
    return { frame, topFrame, redirectedTo };
}
//# sourceMappingURL=navigation-frame.js.map