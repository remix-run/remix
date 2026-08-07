export function getLinkNavigationElement(event) {
    let sourceElement = event.sourceElement;
    if (!(sourceElement instanceof Element))
        return;
    let linkElement = sourceElement.closest('a, area');
    return linkElement instanceof Element ? linkElement : undefined;
}
export function getReplaceHistory(value, defaultValue) {
    if (value === 'replace')
        return true;
    if (value === 'push')
        return false;
    return defaultValue;
}
export function interceptNavigation(event, options) {
    let replacement = options.replacement;
    if (replacement == null) {
        event.intercept({ handler: options.handler });
        return;
    }
    if (replacement.type === 'form-submission' &&
        typeof Reflect.get(window, 'NavigationPrecommitController') === 'function') {
        let interceptOptions = {
            handler: options.handler,
            precommitHandler(controller) {
                controller.redirect(event.destination.url, { history: 'replace' });
            },
        };
        event.intercept(interceptOptions);
        return;
    }
    if (event.cancelable) {
        event.preventDefault();
        window.navigation.navigate(event.destination.url, {
            history: 'replace',
            info: replacement.type === 'form-submission' ? replacement.info : undefined,
            state: replacement.state,
        });
        return;
    }
    event.intercept({ handler: options.handler });
}
//# sourceMappingURL=navigation-event.js.map