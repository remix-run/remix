import type { RoutePattern } from '@remix-run/route-pattern';
import { type BuildRouteMap } from '../route-map.ts';
export type ResourcesMethod = 'index' | 'new' | 'show' | 'create' | 'edit' | 'update' | 'destroy';
export declare const ResourcesMethods: readonly ["index", "new", "show", "create", "edit", "update", "destroy"];
export type ResourcesOptions = {
    /**
     * The parameter name to use for the resource.
     *
     * @default 'id'
     */
    param?: string;
    /**
     * Custom names to use for the resource routes.
     */
    names?: {
        index?: string;
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
     * methods (`index`, `show`, `new`, `create`, `edit`, `update`, and `destroy`)
     * will be included.
     * Cannot be used together with `exclude`.
     */
    only?: ResourcesMethod[];
    exclude?: never;
} | {
    /**
     * The resource methods to exclude from the route map.
     * Cannot be used together with `only`.
     */
    exclude?: ResourcesMethod[];
    only?: never;
});
/**
 * Create a route map with standard CRUD routes for a resource collection.
 *
 * @param base The base route pattern to use for the resources
 * @param options Options to configure the resource routes
 * @returns The route map with CRUD routes
 */
export declare function createResourcesRoutes<base extends string, const options extends ResourcesOptions>(base: base | RoutePattern<base>, options?: options): BuildResourcesMap<base, options>;
type BuildResourcesMap<base extends string, options extends ResourcesOptions> = BuildRouteMap<base, BuildResourcesRoutes<options, options extends {
    only: readonly ResourcesMethod[];
} ? options['only'][number] : options extends {
    exclude: readonly ResourcesMethod[];
} ? Exclude<ResourcesMethod, options['exclude'][number]> : ResourcesMethod, GetParam<options>>>;
type BuildResourcesRoutes<options extends ResourcesOptions, method extends ResourcesMethod, param extends string> = {
    [methodName in method as GetResourcesRouteName<options, methodName>]: ResourcesRoutes<param>[methodName];
};
type GetResourcesRouteName<options extends ResourcesOptions, method extends ResourcesMethod> = method extends ResourcesMethod ? options extends {
    names: {
        [methodName in method]: infer customName extends string;
    };
} ? customName : method : never;
type ResourcesRoutes<param extends string> = {
    index: {
        method: 'GET';
        pattern: `/`;
    };
    new: {
        method: 'GET';
        pattern: `/new`;
    };
    show: {
        method: 'GET';
        pattern: `/:${param}`;
    };
    create: {
        method: 'POST';
        pattern: `/`;
    };
    edit: {
        method: 'GET';
        pattern: `/:${param}/edit`;
    };
    update: {
        method: 'PUT';
        pattern: `/:${param}`;
    };
    destroy: {
        method: 'DELETE';
        pattern: `/:${param}`;
    };
};
type GetParam<options extends ResourcesOptions> = options extends {
    param: infer param extends string;
} ? param : 'id';
export {};
//# sourceMappingURL=resources.d.ts.map