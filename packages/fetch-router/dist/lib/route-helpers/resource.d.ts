import type { RoutePattern } from '@remix-run/route-pattern';
import { type BuildRouteMap } from '../route-map.ts';
export type ResourceMethod = 'new' | 'show' | 'create' | 'edit' | 'update' | 'destroy';
export declare const ResourceMethods: readonly ["new", "show", "create", "edit", "update", "destroy"];
export type ResourceOptions = {
    /**
     * Custom names to use for the resource routes.
     */
    names?: {
        new?: string;
        show?: string;
        create?: string;
        edit?: string;
        update?: string;
        destroy?: string;
    };
} & ({
    /**
     * The resource methods to include in the route map. If not provided, all
     * methods (`show`, `new`, `create`, `edit`, `update`, and `destroy`) will be
     * included.
     * Cannot be used together with `exclude`.
     */
    only?: ResourceMethod[];
    exclude?: never;
} | {
    /**
     * The resource methods to exclude from the route map.
     * Cannot be used together with `only`.
     */
    exclude?: ResourceMethod[];
    only?: never;
});
/**
 * Create a route map with standard CRUD routes for a singleton resource.
 *
 * @param base The base route pattern to use for the resource
 * @param options Options to configure the resource routes
 * @returns The route map with CRUD routes
 */
export declare function createResourceRoutes<base extends string, const options extends ResourceOptions>(base: base | RoutePattern<base>, options?: options): BuildResourceMap<base, options>;
type BuildResourceMap<base extends string, options extends ResourceOptions> = BuildRouteMap<base, BuildResourceRoutes<options, options extends {
    only: readonly ResourceMethod[];
} ? options['only'][number] : options extends {
    exclude: readonly ResourceMethod[];
} ? Exclude<ResourceMethod, options['exclude'][number]> : ResourceMethod>>;
type BuildResourceRoutes<options extends ResourceOptions, method extends ResourceMethod> = {
    [methodName in method as GetRouteName<options, methodName>]: ResourceRoutes[methodName];
};
type GetRouteName<options extends ResourceOptions, method extends ResourceMethod> = method extends ResourceMethod ? options extends {
    names: {
        [methodName in method]: infer customName extends string;
    };
} ? customName : method : never;
type ResourceRoutes = {
    new: {
        method: 'GET';
        pattern: `/new`;
    };
    show: {
        method: 'GET';
        pattern: `/`;
    };
    create: {
        method: 'POST';
        pattern: `/`;
    };
    edit: {
        method: 'GET';
        pattern: `/edit`;
    };
    update: {
        method: 'PUT';
        pattern: `/`;
    };
    destroy: {
        method: 'DELETE';
        pattern: `/`;
    };
};
export {};
//# sourceMappingURL=resource.d.ts.map