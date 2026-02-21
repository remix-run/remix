import { createRoutes } from "../route-map.js";
// prettier-ignore
export const ResourcesMethods = ['index', 'new', 'show', 'create', 'edit', 'update', 'destroy'];
/**
 * Create a route map with standard CRUD routes for a resource collection.
 *
 * @param base The base route pattern to use for the resources
 * @param options Options to configure the resource routes
 * @returns The route map with CRUD routes
 */
export function createResourcesRoutes(base, options) {
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
        only = ResourcesMethods.filter((m) => !options.exclude.includes(m));
    }
    else {
        only = ResourcesMethods;
    }
    let param = options?.param ?? 'id';
    let indexName = options?.names?.index ?? 'index';
    let newName = options?.names?.new ?? 'new';
    let showName = options?.names?.show ?? 'show';
    let createName = options?.names?.create ?? 'create';
    let editName = options?.names?.edit ?? 'edit';
    let updateName = options?.names?.update ?? 'update';
    let destroyName = options?.names?.destroy ?? 'destroy';
    let routes = {};
    if (only.includes('index')) {
        routes[indexName] = { method: 'GET', pattern: `/` };
    }
    if (only.includes('new')) {
        routes[newName] = { method: 'GET', pattern: `/new` };
    }
    if (only.includes('show')) {
        routes[showName] = { method: 'GET', pattern: `/:${param}` };
    }
    if (only.includes('create')) {
        routes[createName] = { method: 'POST', pattern: `/` };
    }
    if (only.includes('edit')) {
        routes[editName] = { method: 'GET', pattern: `/:${param}/edit` };
    }
    if (only.includes('update')) {
        routes[updateName] = { method: 'PUT', pattern: `/:${param}` };
    }
    if (only.includes('destroy')) {
        routes[destroyName] = { method: 'DELETE', pattern: `/:${param}` };
    }
    return createRoutes(base, routes);
}
