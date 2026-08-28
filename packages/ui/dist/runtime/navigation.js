import { getNavigationDriver } from './navigation-driver.js';
/**
 * Performs a client-side transition understood by the Remix frame runtime.
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
    let driver = getNavigationDriver();
    if (driver) {
        await driver.navigate(href, state, options?.history);
        return;
    }
    let destination = new URL(href, document.baseURI);
    if (options?.history === 'replace')
        window.location.replace(destination.href);
    else
        window.location.assign(destination.href);
}
//# sourceMappingURL=navigation.js.map