import { getTopFrame, getNamedFrame } from "./run.js";
const PENDING_FORM_SUBMISSION_TIMEOUT = 1000;
const formSubmissionNavigationInfoType = 'frame-form-submission';
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
 * @param canResolveFrames Whether the runtime has a resolver that can handle intercepted navigations.
 * @returns void
 */
export function startNavigationListener(signal, canResolveFrames = true) {
    if (!canResolveFrames)
        return;
    return startNavigationListenerImpl(signal, { getTopFrame, getNamedFrame });
}
// Internal version used by unit tests so we can inject stub frames
export function startNavigationListenerImpl(signal, options) {
    let navigation = window.navigation;
    // Native form navigation spans three events: `submit` exposes the submitter,
    // `formdata` exposes the browser-built entry list, and `navigate` lets us intercept.
    // Chromium fires `navigate` before `formdata`, so keep per-form state here until
    // the navigation handler can consume it.
    let pendingFormSubmissions = new WeakMap();
    let supportsPrecommit = typeof Reflect.get(window, 'NavigationPrecommitController') === 'function';
    navigation.updateCurrentEntry({
        state: { target: undefined, src: window.location.href, resetScroll: true, $rmx: true },
    });
    document.addEventListener('submit', (event) => {
        let form = event.target;
        if (!(form instanceof HTMLFormElement))
            return;
        let existing = pendingFormSubmissions.get(form);
        if (existing) {
            clearTimeout(existing.timeout);
            existing.removeFormDataListener();
        }
        let eventSubmitter = event instanceof SubmitEvent ? event.submitter : null;
        let onFormData = (event) => {
            let pending = pendingFormSubmissions.get(form);
            if (pending)
                pending.formData = event.formData;
        };
        form.addEventListener('formdata', onFormData);
        let pending = {
            submitter: eventSubmitter instanceof HTMLButtonElement || eventSubmitter instanceof HTMLInputElement
                ? eventSubmitter
                : null,
            timeout: setTimeout(() => {
                if (pendingFormSubmissions.get(form) === pending) {
                    pendingFormSubmissions.delete(form);
                }
                pending.removeFormDataListener();
            }, PENDING_FORM_SUBMISSION_TIMEOUT),
            removeFormDataListener() {
                form.removeEventListener('formdata', onFormData);
            },
        };
        pendingFormSubmissions.set(form, pending);
    }, { capture: true, signal });
    navigation.addEventListener('navigate', (event) => {
        // Safari seems to incorrectly set canIntercept to true for sub-domain navigations, so
        // we do a host check ourselves/. The spec is clear that a different host should prevent
        // interception so this is likely a bug in Safari:
        // https://html.spec.whatwg.org/multipage/nav-history-apis.html#can-have-its-url-rewritten
        if (!event.canIntercept || isCrossOriginDestination(event))
            return;
        let replayedSubmission = isFormSubmissionNavigationInfo(event.info) ? event.info : undefined;
        let runtimeNavigation = replayedSubmission
            ? {
                state: replayedSubmission.state,
                getReloadOptions: replayedSubmission.getReloadOptions,
            }
            : getRuntimeNavigation(event, pendingFormSubmissions);
        if (!runtimeNavigation)
            return;
        let { state } = runtimeNavigation;
        let topFrame = options.getTopFrame();
        let namedFrame = state.target ? options.getNamedFrame(state.target) : undefined;
        let frame = namedFrame ?? topFrame;
        let handler = async () => {
            if (event.navigationType !== 'traverse') {
                navigation.updateCurrentEntry({ state });
            }
            frame.src = frame === topFrame ? event.destination.url : state.src;
            await frame.reload({
                ...(await runtimeNavigation.getReloadOptions?.()),
                signal: event.signal,
            });
            let isNewEntry = event.navigationType === 'push' || event.navigationType === 'replace';
            if (state.resetScroll && isNewEntry) {
                window.scrollTo(0, 0);
            }
        };
        if (runtimeNavigation.replaceHistory && replayedSubmission == null) {
            if (supportsPrecommit) {
                let interceptOptions = {
                    handler,
                    precommitHandler(controller) {
                        controller.redirect(event.destination.url, { history: 'replace' });
                    },
                };
                event.intercept(interceptOptions);
                return;
            }
            if (event.cancelable && runtimeNavigation.getReloadOptions) {
                event.preventDefault();
                navigation.navigate(event.destination.url, {
                    history: 'replace',
                    state,
                    info: {
                        type: formSubmissionNavigationInfoType,
                        state,
                        getReloadOptions: runtimeNavigation.getReloadOptions,
                    },
                });
                return;
            }
        }
        event.intercept({ handler });
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
        'getReloadOptions' in value &&
        typeof value.getReloadOptions === 'function');
}
function isCrossOriginDestination(event) {
    let destination = new URL(event.destination.url);
    return destination.origin !== window.location.origin;
}
function getRuntimeNavigation(event, pendingFormSubmissions) {
    if (event.navigationType === 'traverse') {
        let state = getTraverseNavigationState(event);
        return state ? { state } : undefined;
    }
    let sourceNavigation = getSourceElementNavigation(event, pendingFormSubmissions);
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
function getSourceElementNavigation(event, pendingFormSubmissions) {
    let sourceEvent = event;
    let sourceElement = sourceEvent.sourceElement;
    if (!(sourceElement instanceof Element))
        return;
    let linkElement = sourceElement.closest('a, area');
    if (linkElement instanceof Element) {
        if (linkElement.hasAttribute('rmx-document'))
            return;
        if (linkElement.hasAttribute('download'))
            return;
        return {
            state: {
                target: linkElement.getAttribute('rmx-target') ?? undefined,
                src: linkElement.getAttribute('rmx-src') ?? event.destination.url,
                resetScroll: linkElement.getAttribute('rmx-reset-scroll') !== 'false',
                $rmx: true,
            },
        };
    }
    let form = getSourceForm(sourceElement);
    if (!form)
        return;
    let pending = pendingFormSubmissions.get(form);
    let submitter = pending?.submitter ?? getSourceSubmitter(sourceElement);
    if (hasSubmissionAttribute(form, submitter, 'rmx-document'))
        return;
    let method = getFormMethod(form, submitter);
    let nativeTarget = getSubmissionAttribute(form, submitter, 'target', 'formtarget');
    if (method === 'dialog' || nativeTarget?.toLowerCase() === '_blank')
        return;
    let formEvent = event;
    return {
        state: {
            target: getSubmissionAttribute(form, submitter, 'rmx-target') ?? undefined,
            src: getSubmissionAttribute(form, submitter, 'rmx-src') ?? event.destination.url,
            resetScroll: getSubmissionAttribute(form, submitter, 'rmx-reset-scroll') !== 'false',
            $rmx: true,
        },
        replaceHistory: method.toLowerCase() !== 'get' &&
            event.destination.url === window.navigation.currentEntry?.url,
        async getReloadOptions() {
            // Chromium dispatches `formdata` after `navigate`; let the browser provide the
            // submitted entry list instead of constructing another FormData and firing a duplicate event.
            if (!formEvent.formData && pending && !pending.formData) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
            if (pending) {
                clearTimeout(pending.timeout);
                pending.removeFormDataListener();
                if (pendingFormSubmissions.get(form) === pending) {
                    pendingFormSubmissions.delete(form);
                }
            }
            return {
                formData: formEvent.formData ?? pending?.formData,
                method,
                encType: getFormEncType(form, submitter),
            };
        },
    };
}
function getSourceForm(sourceElement) {
    if (sourceElement instanceof HTMLFormElement)
        return sourceElement;
    return getSourceSubmitter(sourceElement)?.form ?? undefined;
}
function getSourceSubmitter(sourceElement) {
    let submitter = sourceElement.closest('button, input');
    if (submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) {
        return submitter;
    }
    return null;
}
function hasSubmissionAttribute(form, submitter, name) {
    return submitter?.hasAttribute(name) === true || form.hasAttribute(name);
}
function getSubmissionAttribute(form, submitter, name, submitterName = name) {
    if (submitter?.hasAttribute(submitterName)) {
        return submitter.getAttribute(submitterName);
    }
    return form.getAttribute(name);
}
function getFormMethod(form, submitter) {
    if (submitter?.hasAttribute('formmethod')) {
        return submitter.formMethod;
    }
    return form.method;
}
function getFormEncType(form, submitter) {
    if (submitter?.hasAttribute('formenctype')) {
        return submitter.formEnctype;
    }
    return form.enctype;
}
//# sourceMappingURL=navigation.js.map