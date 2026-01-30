import { createRoutes } from "../route-map.js";
// prettier-ignore
export const ResourceMethods = ['new', 'show', 'create', 'edit', 'update', 'destroy'];
/**
 * Create a route map with standard CRUD routes for a singleton resource.
 *
 * @param base The base route pattern to use for the resource
 * @param options Options to configure the resource routes
 * @returns The route map with CRUD routes
 */
export function createResourceRoutes(base, options) {
    // Runtime validation
    if (options?.only && options?.exclude) {
        throw new Error('Cannot specify both "only" and "exclude" options');
    }
    // Resolve which methods to include
    let only;
    if (options?.only) {
        only = options.only;
    }
    else if (options?.exclude) {
        only = ResourceMethods.filter((m) => !options.exclude.includes(m));
    }
    else {
        only = ResourceMethods;
    }
    let newName = options?.names?.new ?? 'new';
    let showName = options?.names?.show ?? 'show';
    let createName = options?.names?.create ?? 'create';
    let editName = options?.names?.edit ?? 'edit';
    let updateName = options?.names?.update ?? 'update';
    let destroyName = options?.names?.destroy ?? 'destroy';
    let routes = {};
    if (only.includes('new')) {
        routes[newName] = { method: 'GET', pattern: `/new` };
    }
    if (only.includes('show')) {
        routes[showName] = { method: 'GET', pattern: `/` };
    }
    if (only.includes('create')) {
        routes[createName] = { method: 'POST', pattern: `/` };
    }
    if (only.includes('edit')) {
        routes[editName] = { method: 'GET', pattern: `/edit` };
    }
    if (only.includes('update')) {
        routes[updateName] = { method: 'PUT', pattern: `/` };
    }
    if (only.includes('destroy')) {
        routes[destroyName] = { method: 'DELETE', pattern: `/` };
    }
    return createRoutes(base, routes);
}
