import { getTopFrame, getNamedFrame } from "./run.js";
export async function navigate(href, options) {
    let state = {
        target: options?.target,
        src: options?.src ?? href,
        resetScroll: options?.resetScroll !== false,
        $rmx: true,
    };
    let transition = window.navigation.navigate(href, { state, history: options?.history });
    await transition.finished;
}
export function startNavigationListener(signal) {
    let navigation = window.navigation;
    navigation.updateCurrentEntry({
        state: { target: undefined, src: window.location.href, resetScroll: true, $rmx: true },
    });
    navigation.addEventListener('navigate', (event) => {
        if (!event.canIntercept)
            return;
        let state = getRuntimeNavigationState(event);
        if (!state)
            return;
        let topFrame = getTopFrame();
        let namedFrame = state.target ? getNamedFrame(state.target) : undefined;
        let frame = namedFrame ?? topFrame;
        event.intercept({
            async handler() {
                if (event.navigationType !== 'traverse') {
                    navigation.updateCurrentEntry({ state });
                }
                frame.src = frame === topFrame ? event.destination.url : state.src;
                await frame.reload();
                let isNewEntry = event.navigationType === 'push' || event.navigationType === 'replace';
                if (state.resetScroll && isNewEntry) {
                    window.scrollTo(0, 0);
                }
            },
        });
    }, { signal });
}
function isRuntimeNavigation(info) {
    return typeof info === 'object' && info != null && '$rmx' in info;
}
function getRuntimeNavigationState(event) {
    if (event.navigationType === 'traverse') {
        return getTraverseNavigationState(event);
    }
    let sourceState = getSourceElementNavigationState(event);
    if (sourceState)
        return sourceState;
    let destinationState = event.destination.getState();
    if (isRuntimeNavigation(destinationState))
        return destinationState;
}
function getTraverseNavigationState(event) {
    let destinationState = event.destination.getState();
    if (isRuntimeNavigation(destinationState)) {
        return destinationState;
    }
    // Safari returns `null` for destination.getState(), even though its in the
    // navigation.entries(), so we do its job for it and look it up.
    let navigation = window.navigation;
    let matchingEntry = navigation.entries().find((entry) => entry.key === event.destination.key);
    if (matchingEntry) {
        let state = matchingEntry.getState();
        if (isRuntimeNavigation(state)) {
            return state;
        }
    }
    return undefined;
}
function getSourceElementNavigationState(event) {
    let sourceEvent = event;
    let sourceElement = sourceEvent.sourceElement;
    if (!(sourceElement instanceof Element))
        return;
    if (!sourceElement.matches('a, area'))
        return;
    if (sourceElement.hasAttribute('rmx-document'))
        return;
    return {
        target: sourceElement.getAttribute('rmx-target') ?? undefined,
        src: sourceElement.getAttribute('rmx-src') ?? event.destination.url,
        resetScroll: sourceElement.getAttribute('rmx-reset-scroll') !== 'false',
        $rmx: true,
    };
}
//# sourceMappingURL=navigation.js.map