export function createComponentErrorEvent(error) {
    return new ErrorEvent('error', { error });
}
export function getComponentError(event) {
    return event.error;
}
//# sourceMappingURL=error-event.js.map