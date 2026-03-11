import { split } from "./route-pattern/split.js";
import { PartPattern } from "./route-pattern/part-pattern.js";
import { parseHostname, parseProtocol, parseSearch } from "./route-pattern/parse.js";
import { serializeSearch } from "./route-pattern/serialize.js";
import { joinPathname, joinSearch } from "./route-pattern/join.js";
import { HrefError, hrefSearch } from "./route-pattern/href.js";
import { matchSearch } from "./route-pattern/match.js";
/**
 * A class for matching and generating URLs based on a defined pattern.
 */
export class RoutePattern {
    ast;
    // The `join()` method bypasses the constructor and creates a new instance directly
    // using `Object.create()`. This means that the constructor will only run for instances
    // that are instantiated directly with a source string, not for all instances of `RoutePattern`.
    // This also means that we cannot use JavaScript features like `#private` fields/methods and
    // class field initializers that rely on the constructor being run.
    constructor(source) {
        let spans = split(source);
        this.ast = {
            protocol: parseProtocol(source, spans.protocol),
            hostname: parseHostname(source, spans.hostname),
            port: spans.port ? source.slice(...spans.port) : null,
            pathname: spans.pathname
                ? PartPattern.parse(source, { span: spans.pathname, type: 'pathname' })
                : PartPattern.parse('', { span: [0, 0], type: 'pathname' }),
            search: spans.search ? parseSearch(source.slice(...spans.search)) : new Map(),
        };
    }
    // eslint-disable-next-line no-restricted-syntax
    get hasOrigin() {
        return this.ast.protocol !== null || this.ast.hostname !== null || this.ast.port !== null;
    }
    get protocol() {
        return this.ast.protocol ?? '';
    }
    get hostname() {
        return this.ast.hostname?.source ?? '';
    }
    get port() {
        return this.ast.port ?? '';
    }
    get pathname() {
        return this.ast.pathname.source;
    }
    get search() {
        return serializeSearch(this.ast.search) ?? '';
    }
    get source() {
        let result = '';
        if (this.hasOrigin) {
            let protocol = this.protocol;
            let hostname = this.hostname;
            let port = this.port === '' ? '' : `:${this.port}`;
            result += `${protocol}://${hostname}${port}`;
        }
        result += '/' + this.pathname;
        let search = this.search;
        if (search)
            result += `?${search}`;
        return result;
    }
    toString() {
        return this.source;
    }
    join(other) {
        other = typeof other === 'string' ? new RoutePattern(other) : other;
        return Object.create(RoutePattern.prototype, {
            ast: {
                enumerable: true,
                value: {
                    protocol: other.ast.protocol ?? this.ast.protocol,
                    hostname: other.ast.hostname ?? this.ast.hostname,
                    port: other.ast.port ?? this.ast.port,
                    pathname: joinPathname(this.ast.pathname, other.ast.pathname),
                    search: joinSearch(this.ast.search, other.ast.search),
                },
            },
        });
    }
    href(...args) {
        let [params, searchParams] = args;
        params ??= {};
        searchParams ??= {};
        let result = '';
        if (this.hasOrigin) {
            // protocol: null defaults to 'https', 'http(s)' defaults to 'https'
            let protocol = this.ast.protocol === null || this.ast.protocol === 'http(s)' ? 'https' : this.ast.protocol;
            // hostname
            if (this.ast.hostname === null) {
                throw new HrefError({
                    type: 'missing-hostname',
                    pattern: this,
                });
            }
            let hostname = this.ast.hostname.href(this, params);
            // port
            let port = this.ast.port === null ? '' : `:${this.ast.port}`;
            result += `${protocol}://${hostname}${port}`;
        }
        // pathname
        let pathname = this.ast.pathname.href(this, params);
        result += '/' + pathname;
        // search
        let search = hrefSearch(this, searchParams);
        if (search)
            result += `?${search}`;
        return result;
    }
    /**
     * Match a URL against this pattern.
     *
     * @param url The URL to match
     * @param options Match options
     * @param options.ignoreCase When `true`, pathname matching is case-insensitive. Defaults to `false`. Hostname is always case-insensitive; search remains case-sensitive.
     * @returns The match result, or `null` if no match
     */
    match(url, options) {
        url = typeof url === 'string' ? new URL(url) : url;
        let hostname = null;
        if (this.hasOrigin) {
            // protocol: null matches http or https, 'http(s)' matches http or https
            if (this.ast.protocol === 'http(s)') {
                if (url.protocol !== 'http:' && url.protocol !== 'https:')
                    return null;
            }
            else if (this.ast.protocol !== null) {
                let expectedProtocol = `${this.ast.protocol}:`;
                if (url.protocol !== expectedProtocol)
                    return null;
            }
            // hostname: null matches any hostname
            if (this.ast.hostname !== null) {
                hostname = this.ast.hostname.match(url.hostname, { ignoreCase: true });
                if (hostname === null)
                    return null;
            }
            // port: null matches empty port
            if (this.ast.port === null && url.port !== '')
                return null;
            if (this.ast.port !== null && url.port !== this.ast.port)
                return null;
        }
        if (this.ast.hostname === null) {
            // Pathname-only pattern - treat hostname as wildcard match
            hostname = [{ type: '*', name: '*', begin: 0, end: url.hostname.length, value: url.hostname }];
        }
        // url.pathname: remove leading slash
        let pathname = this.ast.pathname.match(url.pathname.slice(1), options);
        if (pathname === null)
            return null;
        if (!matchSearch(url.searchParams, this.ast.search))
            return null;
        let params = {};
        // hostname params
        this.ast.hostname?.params.forEach((param) => {
            if (param.name === '*')
                return;
            params[param.name] = undefined;
        });
        hostname?.forEach((param) => {
            if (param.name === '*')
                return;
            params[param.name] = param.value;
        });
        // pathname params
        this.ast.pathname.params.forEach((param) => {
            if (param.name === '*')
                return;
            params[param.name] = undefined;
        });
        pathname.forEach((param) => {
            if (param.name === '*')
                return;
            params[param.name] = param.value;
        });
        return {
            pattern: this,
            url,
            params: params,
            paramsMeta: { hostname: hostname ?? [], pathname },
        };
    }
    test(url) {
        return this.match(url) !== null;
    }
}
