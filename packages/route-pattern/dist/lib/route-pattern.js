import { split } from "./route-pattern/split.js";
import * as Pathname from "./route-pattern/pathname.js";
import * as Search from "./route-pattern/search.js";
import { PartPattern } from "./route-pattern/part-pattern.js";
import * as Parse from "./route-pattern/parse.js";
import * as Href from "./route-pattern/href.js";
export class RoutePattern {
    ast;
    ignoreCase;
    // The `join()` method bypasses the constructor and creates a new instance directly
    // using `Object.create()`. This means that the constructor will only run for instances
    // that are instantiated directly with a source string, not for all instances of `RoutePattern`.
    // This also means that we cannot use JavaScript features like `#private` fields/methods and
    // class field initializers that rely on the constructor being run.
    constructor(source, options) {
        let ignoreCase = options?.ignoreCase ?? false;
        let spans = split(source);
        this.ast = {
            protocol: Parse.protocol(source, spans.protocol),
            hostname: Parse.hostname(source, spans.hostname),
            port: spans.port ? source.slice(...spans.port) : null,
            pathname: spans.pathname
                ? PartPattern.parse(source, { span: spans.pathname, type: 'pathname', ignoreCase })
                : PartPattern.parse('', { span: [0, 0], type: 'pathname', ignoreCase }),
            search: spans.search ? Parse.search(source.slice(...spans.search)) : new Map(),
        };
        this.ignoreCase = ignoreCase;
    }
    // eslint-disable-next-line no-restricted-syntax
    get hasOrigin() {
        return this.ast.protocol !== null || this.ast.hostname !== null || this.ast.port !== null;
    }
    get protocol() {
        return this.ast.protocol ?? '';
    }
    get hostname() {
        return this.ast.hostname?.toString() ?? '';
    }
    get port() {
        return this.ast.port ?? '';
    }
    get pathname() {
        return this.ast.pathname.toString();
    }
    get search() {
        return Search.toString(this.ast.search) ?? '';
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
    join(other, options) {
        other = typeof other === 'string' ? new RoutePattern(other, options) : other;
        let ignoreCase = options?.ignoreCase ?? (this.ignoreCase || other.ignoreCase);
        return Object.create(RoutePattern.prototype, {
            ast: {
                enumerable: true,
                value: {
                    protocol: other.ast.protocol ?? this.ast.protocol,
                    hostname: other.ast.hostname ?? this.ast.hostname,
                    port: other.ast.port ?? this.ast.port,
                    pathname: Pathname.join(this.ast.pathname, other.ast.pathname, ignoreCase),
                    search: Search.join(this.ast.search, other.ast.search),
                },
            },
            ignoreCase: {
                enumerable: true,
                value: ignoreCase,
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
                throw new Href.HrefError({
                    type: 'missing-hostname',
                    pattern: this,
                });
            }
            let hostname = Href.part(this, this.ast.hostname, params);
            // port
            let port = this.ast.port === null ? '' : `:${this.ast.port}`;
            result += `${protocol}://${hostname}${port}`;
        }
        // pathname
        let pathname = Href.part(this, this.ast.pathname, params);
        result += '/' + pathname;
        // search
        let search = Href.search(this, searchParams);
        if (search)
            result += `?${search}`;
        return result;
    }
    match(url) {
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
                hostname = this.ast.hostname.match(url.hostname);
                if (hostname === null)
                    return null;
            }
            // port: null matches any port
            if (this.ast.port !== null) {
                if ((url.port || null) !== this.ast.port)
                    return null;
            }
        }
        // url.pathname: remove leading slash
        let pathname = this.ast.pathname.match(url.pathname.slice(1));
        if (pathname === null)
            return null;
        if (!Search.test(url.searchParams, this.ast.search, this.ignoreCase))
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
            meta: { hostname: hostname ?? [], pathname },
        };
    }
    test(url) {
        return this.match(url) !== null;
    }
}
