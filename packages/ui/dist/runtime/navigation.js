import { getTopFrame, getNamedFrame } from "./run.js";
/**
 * Performs a Navigation API transition understood by Remix frame runtime state.
 *
 * @param href Destination URL.
 * @param options Navigation options.
 */
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
/**
 * Starts listening for Navigation API transitions and routes them through frame reloads.
 *
 * @param signal Abort signal used to remove the listener.
 * @returns void
 */
export function startNavigationListener(signal) {
    return startNavigationListenerImpl(signal, { getTopFrame, getNamedFrame });
}
// Internal version used by unit tests so we can inject stub frames
export function startNavigationListenerImpl(signal, options) {
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
        let topFrame = options.getTopFrame();
        let namedFrame = state.target ? options.getNamedFrame(state.target) : undefined;
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
    let linkElement = sourceElement.closest('a, area');
    if (!(linkElement instanceof Element))
        return;
    if (linkElement.hasAttribute('rmx-document'))
        return;
    if (linkElement.hasAttribute('download'))
        return;
    return {
        target: linkElement.getAttribute('rmx-target') ?? undefined,
        src: linkElement.getAttribute('rmx-src') ?? event.destination.url,
        resetScroll: linkElement.getAttribute('rmx-reset-scroll') !== 'false',
        $rmx: true,
    };
}
//# sourceMappingURL=navigation.js.map