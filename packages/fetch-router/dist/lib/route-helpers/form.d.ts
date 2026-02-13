import type { RoutePattern } from '@remix-run/route-pattern';
import type { RequestMethod } from '../request-methods.ts';
import type { BuildRouteMap } from '../route-map.ts';
export interface FormOptions {
    /**
     * The method the `<form>` uses to submit the action.
     *
     * @default 'POST'
     */
    formMethod?: RequestMethod;
    /**
     * Custom names to use for the `index` and `action` routes.
     */
    names?: {
        index?: string;
        action?: string;
    };
}
/**
 * Create a route map with `index` (`GET`) and `action` (`POST`) routes, suitable
 * for showing a standard HTML `<form>` and handling its submit action at the same
 * URL.
 *
 * @param pattern The route pattern to use for the form and its submit action
 * @param options Options to configure the form action routes
 * @returns The route map with `index` and `action` routes
 */
export declare function createFormRoutes<pattern extends string, const options extends FormOptions>(pattern: pattern | RoutePattern<pattern>, options?: options): BuildFormMap<pattern, options>;
type BuildFormMap<pattern extends string, options extends FormOptions> = BuildRouteMap<pattern, {
    [key in options extends {
        names: {
            index: infer indexName extends string;
        };
    } ? indexName : 'index']: {
        method: 'GET';
        pattern: '/';
    };
} & {
    [key in options extends {
        names: {
            action: infer actionName extends string;
        };
    } ? actionName : 'action']: {
        method: options extends {
            formMethod: infer formMethod extends RequestMethod;
        } ? formMethod : 'POST';
        pattern: '/';
    };
}>;
export {};
//# sourceMappingURL=form.d.ts.map