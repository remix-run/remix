import { getTopFrame, getNamedFrame } from './run.js';
import { reloadFrameForNavigation } from './frame.js';
import { createFormNavigationResolver } from './form-navigation.js';
const formSubmissionNavigationInfoType = 'frame-form-submission';
const frameRedirectNavigationInfoType = 'frame-redirect';
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
    return startNavigationListenerImpl(signal, {
        getTopFrame,
        getNamedFrame,
        reloadFrame: reloadFrameForNavigation,
    });
}
// Internal version used by unit tests so we can inject stub frames
export function startNavigationListenerImpl(signal, options) {
    let navigation = window.navigation;
    let resolveFormNavigation = createFormNavigationResolver(signal);
    navigation.updateCurrentEntry({
        state: { target: undefined, src: window.location.href, resetScroll: true, $rmx: true },
    });
    navigation.addEventListener('navigate', (event) => {
        // Safari seems to incorrectly set canIntercept to true for sub-domain navigations, so
        // we do a host check ourselves/. The spec is clear that a different host should prevent
        // interception so this is likely a bug in Safari:
        // https://html.spec.whatwg.org/multipage/nav-history-apis.html#can-have-its-url-rewritten
        if (!event.canIntercept || isCrossOriginDestination(event))
            return;
        if (isFrameRedirectNavigationInfo(event.info)) {
            event.intercept({
                ...getScrollInterceptionOptions(event, event.info.resetScroll),
                async handler() {
                    if (!event.signal.aborted && event.info.resetScroll) {
                        window.scrollTo(0, 0);
                    }
                },
            });
            return;
        }
        let replayedSubmission = isFormSubmissionNavigationInfo(event.info) ? event.info : undefined;
        let runtimeNavigation = replayedSubmission
            ? {
                state: replayedSubmission.state,
                getSubmission: replayedSubmission.getSubmission,
            }
            : getRuntimeNavigation(event, resolveFormNavigation);
        if (!runtimeNavigation)
            return;
        let { state } = runtimeNavigation;
        let topFrame = options.getTopFrame();
        let namedFrame = state.target ? options.getNamedFrame(state.target) : undefined;
        let frame = namedFrame ?? topFrame;
        let handler = async () => {
            let submission = await runtimeNavigation.getSubmission?.();
            if (event.signal.aborted)
                return;
            if (event.navigationType !== 'traverse') {
                navigation.updateCurrentEntry({ state });
            }
            topFrame.src = event.destination.url;
            if (frame !== topFrame)
                frame.src = state.src;
            let { redirectedTo } = await options.reloadFrame(frame, {
                ...submission,
                signal: event.signal,
            });
            if (redirectedTo !== undefined && frame === topFrame) {
                frame.src = redirectedTo;
                // Start the successor navigation without awaiting it: this handler must settle before
                // the replacement navigation can finish.
                navigation.navigate(redirectedTo, {
                    history: 'replace',
                    state: { ...state, src: redirectedTo },
                    info: {
                        type: frameRedirectNavigationInfoType,
                        resetScroll: state.resetScroll,
                    },
                });
            }
            else {
                let isNewEntry = event.navigationType === 'push' || event.navigationType === 'replace';
                if (!event.signal.aborted && state.resetScroll && isNewEntry) {
                    window.scrollTo(0, 0);
                }
            }
        };
        if (runtimeNavigation.getSubmission) {
            // <form method="post"> navigations
            if (runtimeNavigation.replaceHistory && replayedSubmission == null) {
                let supportsPrecommit = typeof Reflect.get(window, 'NavigationPrecommitController') === 'function';
                // Modern browsers allow you to update the in-flight navigation entry before it's committed
                if (supportsPrecommit) {
                    let interceptOptions = {
                        handler,
                        ...getScrollInterceptionOptions(event, state.resetScroll),
                        precommitHandler(controller) {
                            controller.redirect(event.destination.url, { history: 'replace' });
                        },
                    };
                    event.intercept(interceptOptions);
                    return;
                }
                // Safari doesn't support precommit as of Aug 2026, so we do a full replacement navigation
                if (event.cancelable) {
                    event.preventDefault();
                    window.navigation.navigate(event.destination.url, {
                        history: 'replace',
                        state,
                        info: {
                            type: formSubmissionNavigationInfoType,
                            state,
                            getSubmission: runtimeNavigation.getSubmission,
                        },
                    });
                    return;
                }
            }
            event.intercept({ handler, ...getScrollInterceptionOptions(event, state.resetScroll) });
        }
        else {
            // <a>/<form method="get"> navigations
            if (runtimeNavigation.replaceHistory && event.cancelable) {
                event.preventDefault();
                navigation.navigate(event.destination.url, { history: 'replace', state });
            }
            else {
                event.intercept({ handler, ...getScrollInterceptionOptions(event, state.resetScroll) });
            }
        }
    }, { signal });
}
function isRuntimeNavigation(info) {
    return typeof info === 'object' && info != null && '$rmx' in info;
}
function getScrollInterceptionOptions(event, resetScroll) {
    let isNewEntry = event.navigationType === 'push' || event.navigationType === 'replace';
    return isNewEntry && !resetScroll ? { scroll: 'manual' } : {};
}
function isFormSubmissionNavigationInfo(value) {
    return (typeof value === 'object' &&
        value != null &&
        'type' in value &&
        value.type === formSubmissionNavigationInfoType &&
        'state' in value &&
        isRuntimeNavigation(value.state) &&
        'getSubmission' in value &&
        typeof value.getSubmission === 'function');
}
function isFrameRedirectNavigationInfo(value) {
    return (typeof value === 'object' &&
        value != null &&
        'type' in value &&
        value.type === frameRedirectNavigationInfoType &&
        'resetScroll' in value &&
        typeof value.resetScroll === 'boolean');
}
function isCrossOriginDestination(event) {
    let destination = new URL(event.destination.url);
    return destination.origin !== window.location.origin;
}
function getRuntimeNavigation(event, resolveFormNavigation) {
    if (event.navigationType === 'traverse') {
        let state = getTraverseNavigationState(event);
        return state ? { state } : undefined;
    }
    let sourceNavigation = getSourceElementNavigation(event, resolveFormNavigation);
    if (sourceNavigation)
        return sourceNavigation;
    let destinationState = event.destination.getState();
    if (isRuntimeNavigation(destinationState))
        return { state: destinationState };
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
function getSourceElementNavigation(event, resolveFormNavigation) {
    let sourceEvent = event;
    let sourceElement = sourceEvent.sourceElement;
    if (!(sourceElement instanceof Element))
        return;
    let linkElement = sourceElement.closest('a, area');
    if (linkElement instanceof Element) {
        if (linkElement.hasAttribute('data-rmx-document'))
            return;
        if (linkElement.hasAttribute('download'))
            return;
        return {
            state: {
                target: linkElement.getAttribute('data-rmx-target') ?? undefined,
                src: linkElement.getAttribute('data-rmx-src') ?? event.destination.url,
                resetScroll: linkElement.getAttribute('data-rmx-reset-scroll') !== 'false',
                $rmx: true,
            },
            replaceHistory: getReplaceHistory(linkElement.getAttribute('data-rmx-history'), false),
        };
    }
    let formNavigation = resolveFormNavigation(event);
    if (!formNavigation || formNavigation.hasAttribute('data-rmx-document'))
        return;
    let replaceHistoryByDefault = formNavigation.getSubmission !== undefined &&
        event.destination.url === window.navigation.currentEntry?.url;
    return {
        state: {
            target: formNavigation.getAttribute('data-rmx-target') ?? undefined,
            src: formNavigation.getAttribute('data-rmx-src') ?? event.destination.url,
            resetScroll: formNavigation.getAttribute('data-rmx-reset-scroll') !== 'false',
            $rmx: true,
        },
        replaceHistory: getReplaceHistory(formNavigation.getAttribute('data-rmx-history'), replaceHistoryByDefault),
        getSubmission: formNavigation.getSubmission,
    };
}
function getReplaceHistory(value, defaultValue) {
    if (value === 'replace')
        return true;
    if (value === 'push')
        return false;
    return defaultValue;
}
//# sourceMappingURL=navigation.js.map