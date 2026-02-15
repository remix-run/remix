/**
 * Creates a model registry.
 *
 * Call `bind(database)` per request to get a registry object whose model
 * classes are bound to that database.
 *
 * @param models Model definitions to include in this registry.
 * @returns A registry with a `bind(database)` method.
 */
export function createModelRegistry(models) {
    return {
        bind(database) {
            let registry = {};
            for (let name in models) {
                ;
                registry[name] = models[name].bind(database);
            }
            return registry;
        },
    };
}
