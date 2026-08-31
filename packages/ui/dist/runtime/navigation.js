import { getTopFrame, getNamedFrame } from './run.js';
import { reloadFrameForNavigation } from './frame.js';
import { createFormNavigationResolver } from './form-navigation.js';
const formSubmissionNavigationInfoType = 'frame-form-submission';
const frameRedirectNavigationInfoType = 'frame-redirect';
function resyncWebKitScrollAfterNavigation(event, transition) {
    let userAgent = navigator.userAgent;
    if (!userAgent.includes('AppleWebKit'))
        return;
    if (userAgent.includes('Chrome') || userAgent.includes('Chromium'))
        return;
    if (event.navigationType !== 'push' && event.navigationType !== 'replace')
        return;
    if (new URL(event.destination.url).hash)
        return;
    void transition.finished.then(() => {
        // WebKit can reset its internal scroll position without synchronizing the visual viewport.
        // https://bugs.webkit.org/show_bug.cgi?id=309542
        if (event.signal.aborted || window.scrollX !== 0 || window.scrollY !== 0)
            return;
        window.scrollTo({ behavior: 'instant', left: 0, top: 1 });
        requestAnimationFrame(() => {
            if (event.signal.aborted || window.scrollX !== 0 || window.scrollY !== 1)
                return;
            window.scrollTo({ behavior: 'instant', left: 0, top: 0 });
        });
    }, () => { });
}
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
    let navigation = window.navigation;
    if (!navigation) {
        if (options?.history === 'replace') {
            window.location.replace(href);
        }
        else {
            window.location.assign(href);
        }
        return;
    }
    let transition = navigation.navigate(href, { state, history: options?.history });
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
    if (!navigation)
        return;
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
            interceptNavigation(navigation, event, event.info.resetScroll, {
                async handler() { },
                scroll: event.info.resetScroll === false ? 'manual' : undefined,
            });
            return;
        }
        let replayedSubmission = isFormSubmissionNavigationInfo(event.info) ? event.info : undefined;
        let runtimeNavigation = replayedSubmission
            ? {
                state: replayedSubmission.state,
                getSubmission: replayedSubmission.getSubmission,
            }
            : getRuntimeNavigation(navigation, event, resolveFormNavigation);
        if (!runtimeNavigation)
            return;
        let { state } = runtimeNavigation;
        let topFrame = options.getTopFrame();
        let namedFrame = state.target ? options.getNamedFrame(state.target) : undefined;
        let frame = namedFrame ?? topFrame;
        let handler = async () => {
            if (event.signal.aborted)
                return;
            let submission = await runtimeNavigation.getSubmission?.();
            if (event.signal.aborted)
                return;
            if (event.navigationType !== 'traverse') {
                navigation.updateCurrentEntry({ state });
            }
            topFrame.src = event.destination.url;
            if (frame !== topFrame)
                frame.src = state.src;
            let reload = options.reloadFrame(frame, {
                ...submission,
                signal: event.signal,
            });
            await reload.committed;
            if (event.signal.aborted)
                return;
            if (state.resetScroll)
                event.scroll();
            let { redirectedTo } = await reload.finished;
            if (redirectedTo && frame === topFrame) {
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
        };
        let interceptOptions = {
            handler,
            scroll: state.resetScroll === false ? 'manual' : undefined,
        };
        if (runtimeNavigation.getSubmission) {
            // <form method="post"> navigations
            if (runtimeNavigation.replaceHistory && replayedSubmission == null) {
                let supportsPrecommit = typeof Reflect.get(window, 'NavigationPrecommitController') === 'function';
                // Modern browsers allow you to update the in-flight navigation entry before it's committed
                if (supportsPrecommit) {
                    interceptNavigation(navigation, event, state.resetScroll, {
                        ...interceptOptions,
                        precommitHandler(controller) {
                            controller.redirect(event.destination.url, { history: 'replace' });
                        },
                    });
                    return;
                }
                // Safari doesn't support precommit as of Aug 2026, so we do a full replacement navigation
                if (event.cancelable) {
                    event.preventDefault();
                    navigation.navigate(event.destination.url, {
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
            interceptNavigation(navigation, event, state.resetScroll, interceptOptions);
        }
        else {
            // <a>/<form method="get"> navigations
            if (runtimeNavigation.replaceHistory && event.cancelable) {
                event.preventDefault();
                navigation.navigate(event.destination.url, { history: 'replace', state });
            }
            else {
                interceptNavigation(navigation, event, state.resetScroll, interceptOptions);
            }
        }
    }, { signal });
}
function isRuntimeNavigation(info) {
    return typeof info === 'object' && info != null && '$rmx' in info;
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
function interceptNavigation(navigation, event, resetScroll, options) {
    let removeScrollStyles = resetScroll ? preserveNavigationScroll(event) : undefined;
    try {
        event.intercept({
            ...options,
            handler() {
                let transition = navigation.transition;
                if (resetScroll && transition) {
                    resyncWebKitScrollAfterNavigation(event, transition);
                    if (removeScrollStyles) {
                        void transition.finished.then(() => {
                            if (event.navigationType === 'traverse')
                                return removeScrollStyles();
                            // Keep the stylesheet through the first post-navigation paint.
                            requestAnimationFrame(() => requestAnimationFrame(removeScrollStyles));
                        }, removeScrollStyles);
                    }
                }
                else {
                    removeScrollStyles?.();
                }
                return options.handler?.();
            },
        });
    }
    catch (error) {
        removeScrollStyles?.();
        throw error;
    }
}
function preserveNavigationScroll(event) {
    if (event.signal.aborted)
        return;
    let cssText;
    if (event.navigationType === 'traverse') {
        // Reconciliation can temporarily shrink the document before the browser restores its scroll.
        // Keep the starting scroll range stable until restoration finishes.
        let { scrollHeight, clientHeight } = document.documentElement;
        cssText = `
      html {
        min-height: ${scrollHeight + clientHeight}px !important;
        overflow-anchor: none !important;
      }

      body {
        overflow-anchor: none !important;
      }
    `;
    }
    else {
        if (event.navigationType !== 'push' && event.navigationType !== 'replace')
            return;
        if (new URL(event.destination.url).hash)
            return;
        // Keep later reconciliation from anchoring away from the browser's destination scroll.
        cssText = `
      html,
      body {
        overflow-anchor: none !important;
      }
    `;
    }
    let stylesheet = new CSSStyleSheet();
    stylesheet.replaceSync(cssText);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, stylesheet];
    function remove() {
        event.signal.removeEventListener('abort', remove);
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((current) => current !== stylesheet);
    }
    event.signal.addEventListener('abort', remove, { once: true });
    return remove;
}
function getRuntimeNavigation(navigation, event, resolveFormNavigation) {
    if (event.navigationType === 'traverse') {
        let state = getTraverseNavigationState(navigation, event);
        return state ? { state } : undefined;
    }
    let sourceNavigation = getSourceElementNavigation(navigation, event, resolveFormNavigation);
    if (sourceNavigation)
        return sourceNavigation;
    let destinationState = event.destination.getState();
    if (isRuntimeNavigation(destinationState))
        return { state: destinationState };
}
function getTraverseNavigationState(navigation, event) {
    let destinationState = event.destination.getState();
    if (isRuntimeNavigation(destinationState)) {
        return destinationState;
    }
    // Safari returns `null` for destination.getState(), even though its in the
    // navigation.entries(), so we do its job for it and look it up.
    let matchingEntry = navigation.entries().find((entry) => entry.key === event.destination.key);
    if (matchingEntry) {
        let state = matchingEntry.getState();
        if (isRuntimeNavigation(state)) {
            return state;
        }
    }
    return undefined;
}
function getSourceElementNavigation(navigation, event, resolveFormNavigation) {
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
        event.destination.url === navigation.currentEntry?.url;
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