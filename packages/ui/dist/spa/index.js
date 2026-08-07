import { addEventListeners } from '@remix-run/ui';
import { createFormNavigationResolver } from '../runtime/form-navigation.js';
import { getLinkNavigationElement, getReplaceHistory, interceptNavigation, } from '../runtime/navigation-event.js';
const formSubmissionNavigationInfoType = 'spa-form-submission';
/**
 * Renders browser URLs through a URL-to-node router and intercepts same-origin navigations.
 *
 * Form submissions use their native method. Non-GET submissions include their `FormData` and
 * replace the current history entry when submitted to the active URL. Submissions to a different
 * URL push a new entry. Navigation history entries do not retain submitted `FormData`, so history
 * traversals revisit form destinations with `GET` requests. Links and forms can use
 * `rmx-document` to bypass SPA interception or `rmx-history` to control history behavior.
 *
 * @param handle Component handle containing the router and initial fallback.
 * @returns A render function for the active router output.
 */
export function SPA(handle) {
    let spa = createSPA(handle, handle.props);
    handle.context.set(spa.context);
    return () => spa.node;
}
/**
 * Creates SPA navigation state for use in a component setup scope.
 *
 * @param handle Component handle that owns the SPA navigation lifecycle.
 * @param options Router and fallback UI used to resolve browser URLs.
 * @returns Live SPA navigation state and rendered UI.
 */
export function createSPA(handle, options) {
    let node = options.fallback;
    let currentController;
    let active = new URL(window.location.href);
    let pending;
    let resolveFormNavigation;
    let context = {
        get active() {
            return active;
        },
        get pending() {
            return pending;
        },
    };
    function onNavigate(navigateEvent) {
        if (!navigateEvent.canIntercept)
            return;
        if (navigateEvent.hashChange)
            return;
        if (navigateEvent.downloadRequest)
            return;
        let destination = new URL(navigateEvent.destination.url);
        if (destination.origin !== window.location.origin)
            return;
        let replayedSubmission = isFormSubmissionNavigationInfo(navigateEvent.info)
            ? navigateEvent.info
            : undefined;
        let linkElement = replayedSubmission ? undefined : getLinkNavigationElement(navigateEvent);
        let formNavigation = replayedSubmission ? undefined : resolveFormNavigation(navigateEvent);
        if (linkElement?.hasAttribute('rmx-document'))
            return;
        if (formNavigation?.hasAttribute('rmx-document'))
            return;
        let getSubmission = replayedSubmission?.getSubmission ?? formNavigation?.getSubmission;
        let replaceHistoryByDefault = formNavigation?.getSubmission !== undefined && destination.href === active.href;
        let replaceHistory = replayedSubmission == null &&
            getReplaceHistory(linkElement?.getAttribute('rmx-history') ??
                formNavigation?.getAttribute('rmx-history') ??
                null, replaceHistoryByDefault);
        let handler = async () => {
            let submission = await getSubmission?.();
            if (navigateEvent.signal.aborted)
                return;
            await updatePage(destination, navigateEvent.signal, submission);
        };
        let replacement;
        if (replaceHistory) {
            replacement = getSubmission
                ? {
                    type: 'form-submission',
                    info: {
                        type: formSubmissionNavigationInfoType,
                        getSubmission,
                    },
                }
                : { type: 'navigation' };
        }
        interceptNavigation(navigateEvent, { handler, replacement });
    }
    async function updatePage(url, navigationSignal, submission) {
        currentController?.abort();
        let controller = new AbortController();
        let signal = AbortSignal.any([handle.signal, navigationSignal, controller.signal]);
        currentController = controller;
        pending = url;
        handle.update();
        try {
            let init = { signal };
            if (submission) {
                init.method = submission.method.toUpperCase();
                if (init.method !== 'GET' && init.method !== 'HEAD') {
                    init.body = submission.formData;
                }
            }
            let nextNode = await options.router.fetch(url, init);
            if (signal.aborted)
                return;
            node = nextNode;
            active = url;
        }
        catch (error) {
            if (!signal.aborted)
                throw error;
        }
        finally {
            if (currentController === controller) {
                currentController = undefined;
                pending = undefined;
                handle.update();
            }
        }
    }
    handle.queueTask(() => {
        resolveFormNavigation = createFormNavigationResolver(handle.signal);
        addEventListeners(window.navigation, handle.signal, { navigate: onNavigate });
        void updatePage(new URL(window.location.href), handle.signal, undefined);
    });
    return {
        get context() {
            return context;
        },
        get node() {
            return node;
        },
    };
}
function isFormSubmissionNavigationInfo(value) {
    return (typeof value === 'object' &&
        value != null &&
        'type' in value &&
        value.type === formSubmissionNavigationInfoType &&
        'getSubmission' in value &&
        typeof value.getSubmission === 'function');
}
//# sourceMappingURL=index.js.map