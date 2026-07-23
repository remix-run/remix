import { addEventListeners } from '@remix-run/ui';
const formSubmissionNavigationInfoType = 'spa-form-submission';
/**
 * Renders browser URLs through a URL-to-node router and intercepts same-origin navigations.
 *
 * Form submissions are dispatched as `POST` requests with their `FormData`. Submissions to the
 * active URL replace the current history entry, while submissions to a different URL push a new
 * entry. Navigation history entries do not retain submitted `FormData`, so history traversals
 * revisit form destinations with `GET` requests.
 *
 * @param handle Component handle containing the router and initial fallback.
 * @returns A render function for the active router output.
 */
export function SPA(handle) {
    let currentNode = handle.props.fallback;
    let currentController;
    let active = new URL(window.location.href);
    let pending;
    let supportsPrecommit = typeof Reflect.get(window, 'NavigationPrecommitController') === 'function';
    handle.context.set({
        get active() {
            return active;
        },
        get pending() {
            return pending;
        },
    });
    async function updatePage(url, navigationSignal, formData) {
        currentController?.abort();
        let controller = new AbortController();
        let signal = AbortSignal.any([handle.signal, navigationSignal, controller.signal]);
        currentController = controller;
        pending = url;
        handle.update();
        try {
            let init = { signal };
            if (formData != null) {
                init.method = 'POST';
                init.body = formData;
            }
            let node = await handle.props.router.fetch(url, init);
            if (signal.aborted)
                return;
            currentNode = node;
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
    addEventListeners(window.navigation, handle.signal, {
        navigate(navigateEvent) {
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
            let formData = navigateEvent.formData ?? replayedSubmission?.formData ?? null;
            let shouldReplace = formData != null && destination.href === active.href && navigateEvent.cancelable;
            if (shouldReplace && formData != null && !supportsPrecommit && replayedSubmission == null) {
                navigateEvent.preventDefault();
                window.navigation.navigate(destination.href, {
                    history: 'replace',
                    info: {
                        type: formSubmissionNavigationInfoType,
                        formData,
                    },
                });
                return;
            }
            let handler = () => updatePage(destination, navigateEvent.signal, formData);
            if (shouldReplace && supportsPrecommit && replayedSubmission == null) {
                let options = {
                    handler,
                    precommitHandler(controller) {
                        controller.redirect(destination.href, { history: 'replace' });
                    },
                };
                navigateEvent.intercept(options);
            }
            else {
                navigateEvent.intercept({ handler });
            }
        },
    });
    handle.queueTask(() => updatePage(new URL(window.location.href), handle.signal, null));
    return () => currentNode;
}
function isFormSubmissionNavigationInfo(value) {
    return (typeof value === 'object' &&
        value != null &&
        'type' in value &&
        value.type === formSubmissionNavigationInfoType &&
        'formData' in value &&
        value.formData instanceof FormData);
}
//# sourceMappingURL=index.js.map