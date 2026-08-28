let activeDriver;
export function setNavigationDriver(signal, driver) {
    let registration = { driver, signal };
    activeDriver = registration;
    signal.addEventListener('abort', () => {
        if (activeDriver === registration)
            activeDriver = undefined;
    }, { once: true });
}
export function getNavigationDriver() {
    if (activeDriver?.signal.aborted)
        activeDriver = undefined;
    return activeDriver?.driver;
}
//# sourceMappingURL=navigation-driver.js.map