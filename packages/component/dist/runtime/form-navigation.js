const PENDING_FORM_SUBMISSION_TIMEOUT = 1000;
/**
 * Tracks native form events and resolves their corresponding Navigation API events.
 *
 * @param signal Signal used to stop tracking form events.
 * @returns A function that resolves form metadata for a navigation event.
 */
export function createFormNavigationResolver(signal) {
    // Index each submission by its form and submitter so detached submitters can still find their form.
    let pendingSubmissions = new WeakMap();
    function clearPending(pending) {
        clearTimeout(pending.timeout);
        pending.removeFormDataListener();
        if (pendingSubmissions.get(pending.form) === pending) {
            pendingSubmissions.delete(pending.form);
        }
        if (pending.submitter && pendingSubmissions.get(pending.submitter) === pending) {
            pendingSubmissions.delete(pending.submitter);
        }
    }
    // Cache the authoritative submitter and native data for the matching `navigate` event.
    // Unmatched submits expire.
    document.addEventListener('submit', (event) => {
        let form = event.target;
        if (!(form instanceof HTMLFormElement))
            return;
        let eventSubmitter = event instanceof SubmitEvent ? event.submitter : null;
        let submitter = eventSubmitter instanceof HTMLButtonElement || eventSubmitter instanceof HTMLInputElement
            ? eventSubmitter
            : null;
        function onFormData(formDataEvent) {
            // Native formdata follows an uncanceled submit. Ignore snapshots made in submit handlers
            // or after cancellation, and stop listening before later snapshots can replace this data.
            if (event.eventPhase !== Event.NONE || event.defaultPrevented)
                return;
            // A canceled retry must not replace a submission whose navigation is still pending.
            let existing = pendingSubmissions.get(pending.form);
            if (existing)
                clearPending(existing);
            pending.formData = formDataEvent.formData;
            pendingSubmissions.set(pending.form, pending);
            if (submitter)
                pendingSubmissions.set(submitter, pending);
            pending.removeFormDataListener();
        }
        let pending = {
            form,
            submitter,
            timeout: setTimeout(() => clearPending(pending), PENDING_FORM_SUBMISSION_TIMEOUT),
            removeFormDataListener() {
                form.removeEventListener('formdata', onFormData);
            },
        };
        form.addEventListener('formdata', onFormData, { signal });
    }, { capture: true, signal });
    return (event) => {
        let sourceElement = event.sourceElement;
        if (!(sourceElement instanceof Element))
            return;
        let form = getSourceForm(sourceElement, pendingSubmissions);
        if (!form)
            return;
        let pending = pendingSubmissions.get(form);
        let submitter = pending?.submitter ?? null;
        let method = getFormMethod(form, submitter);
        let encType = getFormEncType(form, submitter);
        let target = getSubmissionAttribute(form, submitter, 'target', 'formtarget');
        if (method === 'dialog' || target?.toLowerCase() === '_blank')
            return;
        let formEvent = event;
        let getSubmission;
        if (method.toLowerCase() === 'get') {
            if (pending)
                clearPending(pending);
        }
        else {
            getSubmission = async () => {
                if (pending)
                    clearPending(pending);
                return {
                    formData: formEvent.formData ?? pending?.formData,
                    method,
                    encType,
                };
            };
        }
        return {
            hasAttribute(name) {
                return submitter?.hasAttribute(name) === true || form.hasAttribute(name);
            },
            getAttribute(name, submitterName) {
                return getSubmissionAttribute(form, submitter, name, submitterName);
            },
            getSubmission,
        };
    };
}
function getSourceForm(sourceElement, pendingSubmissions) {
    // A form navigation's source element is the submitted form or its submit button.
    // https://html.spec.whatwg.org/multipage/nav-history-apis.html#dom-navigateevent-sourceelement
    if (sourceElement instanceof HTMLFormElement)
        return sourceElement;
    if (sourceElement instanceof HTMLButtonElement || sourceElement instanceof HTMLInputElement) {
        // `sourceElement.form` is null when the button was detached before the `navigate` event fired
        // (e.g. a temporary button appended, clicked, and immediately removed). Fall back to the form
        // reference captured at `submit` time when the button was still attached.
        return sourceElement.form ?? pendingSubmissions.get(sourceElement)?.form;
    }
}
function getSubmissionAttribute(form, submitter, name, submitterName) {
    submitterName ??= name;
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
//# sourceMappingURL=form-navigation.js.map