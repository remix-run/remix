import { RoutePattern } from "./route-pattern.js";
import * as RE from "./regexp.js";
import { unreachable } from "./errors.js";
import * as Search from "./route-pattern/search.js";
import * as Specificity from "./specificity.js";
export class TrieMatcher {
    trie;
    constructor() {
        this.trie = new Trie();
    }
    add(pattern, data) {
        pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern;
        this.trie.insert(pattern, data);
    }
    match(url, compareFn = Specificity.descending) {
        url = typeof url === 'string' ? new URL(url) : url;
        let matches = this.matchAll(url, compareFn);
        return matches[0] ?? null;
    }
    matchAll(url, compareFn = Specificity.descending) {
        url = typeof url === 'string' ? new URL(url) : url;
        let matches = this.trie.search(url);
        return matches
            .map((match) => {
            let params = {};
            for (let param of match.hostname) {
                if (param.name === '*')
                    continue;
                params[param.name] = param.value;
            }
            for (let param of match.pathname) {
                if (param.name === '*')
                    continue;
                params[param.name] = param.value;
            }
            return {
                pattern: match.pattern,
                url,
                params: match.params,
                meta: { hostname: match.hostname, pathname: match.pathname },
                data: match.data,
            };
        })
            .sort(compareFn);
    }
}
function variants(pattern) {
    // prettier-ignore
    let protocols = pattern.ast.protocol === null ? ['http', 'https'] :
        pattern.ast.protocol === 'http(s)' ? ['http', 'https'] :
            [pattern.ast.protocol];
    // prettier-ignore
    let hostnames = pattern.ast.hostname === null ? [{ type: 'any' }] :
        pattern.ast.hostname.paramNames.length === 0 ?
            pattern.ast.hostname.variants.map((variant) => ({ type: 'static', value: variant.toString() })) :
            [{ type: 'dynamic', value: pattern.ast.hostname }];
    let pathnames = pattern.ast.pathname.variants;
    let result = [];
    for (let protocol of protocols) {
        for (let hostname of hostnames) {
            for (let pathname of pathnames) {
                result.push({ protocol, hostname, port: pattern.ast.port ?? '', pathname });
            }
        }
    }
    return result;
}
function createHostnameNode() {
    return {
        static: new Map(),
        dynamic: [],
        any: new Map(),
    };
}
function createPathnameNode() {
    return {
        static: new Map(),
        variable: new Map(),
        wildcard: new Map(),
        value: null,
    };
}
export class Trie {
    protocolNode;
    constructor() {
        this.protocolNode = {
            http: createHostnameNode(),
            https: createHostnameNode(),
        };
    }
    insert(pattern, data) {
        for (let variant of variants(pattern)) {
            // protocol -> hostname
            let hostnameNode = this.protocolNode[variant.protocol];
            // hostname -> port
            let portNode = undefined;
            if (variant.hostname.type === 'any') {
                portNode = hostnameNode.any;
            }
            else if (variant.hostname.type === 'static') {
                portNode = hostnameNode.static.get(variant.hostname.value);
                if (portNode === undefined) {
                    portNode = new Map();
                    hostnameNode.static.set(variant.hostname.value, portNode);
                }
            }
            else {
                portNode = new Map();
                hostnameNode.dynamic.push({ part: variant.hostname.value, portNode });
            }
            // port -> pathname
            let pathnameRoot = portNode?.get(variant.port);
            if (pathnameRoot === undefined) {
                pathnameRoot = createPathnameNode();
                portNode.set(variant.port, pathnameRoot);
            }
            // pathname segments
            let pathnameNode = pathnameRoot;
            let segments = toSegments(variant.pathname);
            for (let segment of segments) {
                if (segment.type === 'static') {
                    let next = pathnameNode.static.get(segment.key);
                    if (next === undefined) {
                        next = createPathnameNode();
                        pathnameNode.static.set(segment.key, next);
                    }
                    pathnameNode = next;
                    continue;
                }
                if (segment.type === 'variable') {
                    let next = pathnameNode.variable.get(segment.key);
                    if (next === undefined) {
                        next = { regexp: segment.regexp, pathnameNode: createPathnameNode() };
                        pathnameNode.variable.set(segment.key, next);
                    }
                    pathnameNode = next.pathnameNode;
                    continue;
                }
                if (segment.type === 'wildcard') {
                    let next = pathnameNode.wildcard.get(segment.key);
                    if (next === undefined) {
                        next = { regexp: segment.regexp, pathnameNode: createPathnameNode() };
                        pathnameNode.wildcard.set(segment.key, next);
                    }
                    pathnameNode = next.pathnameNode;
                    continue;
                }
                unreachable(segment);
            }
            let { requiredParams } = variant.pathname;
            let undefinedParams = [];
            for (let param of pattern.ast.pathname.paramNames) {
                if (!requiredParams.includes(param) && !undefinedParams.includes(param)) {
                    undefinedParams.push(param);
                }
            }
            pathnameNode.value = {
                pattern,
                data,
                requiredParams,
                undefinedParams,
            };
        }
    }
    search(url) {
        let origins = [];
        // protocol -> hostname
        let protocol = url.protocol.slice(0, -1);
        if (protocol !== 'http' && protocol !== 'https')
            return [];
        let hostNameNode = this.protocolNode[protocol];
        // any hostname + port -> pathname
        let anyHostname = hostNameNode.any.get(url.port);
        if (anyHostname) {
            origins.push({
                hostnameMatch: [
                    { type: '*', name: '*', begin: 0, end: url.hostname.length, value: url.hostname },
                ],
                pathnameNode: anyHostname,
            });
        }
        // static hostname + port -> pathname
        let staticHostname = hostNameNode.static.get(url.hostname);
        if (staticHostname) {
            let pathnameNode = staticHostname.get(url.port);
            if (pathnameNode) {
                origins.push({ hostnameMatch: [], pathnameNode });
            }
        }
        // dynamic hostname + port -> pathname
        hostNameNode.dynamic.forEach(({ part, portNode }) => {
            let match = part.match(url.hostname);
            if (match) {
                let pathnameNode = portNode.get(url.port);
                if (pathnameNode) {
                    origins.push({ hostnameMatch: match, pathnameNode });
                }
            }
        });
        let results = [];
        // pathname
        let urlSegments = url.pathname.slice(1).split('/');
        for (let origin of origins) {
            let stack = [
                { segmentIndex: 0, pathnameNode: origin.pathnameNode, charOffset: 0, pathnameMatch: [] },
            ];
            while (stack.length > 0) {
                let current = stack.pop();
                if (current.segmentIndex === urlSegments.length) {
                    let { value } = current.pathnameNode;
                    if (value &&
                        Search.test(url.searchParams, value.pattern.ast.search, value.pattern.ignoreCase)) {
                        let pathnameMatch = [];
                        for (let i = 0; i < value.requiredParams.length; i++) {
                            let name = value.requiredParams[i];
                            let rest = current.pathnameMatch[i];
                            pathnameMatch.push({
                                ...rest,
                                name,
                            });
                        }
                        let params = {};
                        for (let param of value.undefinedParams) {
                            params[param] = undefined;
                        }
                        for (let param of origin.hostnameMatch) {
                            if (param.name === '*')
                                continue;
                            params[param.name] = param.value;
                        }
                        for (let param of pathnameMatch) {
                            if (param.name === '*')
                                continue;
                            params[param.name] = param.value;
                        }
                        results.push({
                            pattern: value.pattern,
                            data: value.data,
                            hostname: origin.hostnameMatch,
                            pathname: pathnameMatch,
                            params,
                        });
                    }
                    continue;
                }
                let urlSegment = urlSegments[current.segmentIndex];
                let nextStatic = current.pathnameNode.static.get(urlSegment);
                if (nextStatic) {
                    stack.push({
                        segmentIndex: current.segmentIndex + 1,
                        pathnameNode: nextStatic,
                        charOffset: current.charOffset + urlSegment.length + 1,
                        pathnameMatch: current.pathnameMatch,
                    });
                }
                for (let { regexp, pathnameNode } of current.pathnameNode.variable.values()) {
                    let match = regexp.exec(urlSegment);
                    if (match) {
                        let pathnameMatch = current.pathnameMatch.slice();
                        for (let group in match.indices?.groups) {
                            let prefix = group[0];
                            if (prefix !== 'v' && prefix !== 'w')
                                continue;
                            let type = prefix === 'v' ? ':' : '*';
                            let span = match.indices.groups[group];
                            if (span === undefined)
                                continue;
                            pathnameMatch.push({
                                type,
                                begin: current.charOffset + span[0],
                                end: current.charOffset + span[1],
                                value: match.groups[group],
                            });
                        }
                        stack.push({
                            segmentIndex: current.segmentIndex + 1,
                            pathnameNode,
                            charOffset: current.charOffset + match.index + match[0].length + 1,
                            pathnameMatch,
                        });
                    }
                }
                for (let { regexp, pathnameNode } of current.pathnameNode.wildcard.values()) {
                    let remaining = urlSegments.slice(current.segmentIndex).join('/');
                    let match = regexp.exec(remaining);
                    if (match) {
                        let pathnameMatch = current.pathnameMatch.slice();
                        for (let group in match.indices?.groups) {
                            let prefix = group[0];
                            if (prefix !== 'v' && prefix !== 'w')
                                continue;
                            let type = prefix === 'v' ? ':' : '*';
                            let span = match.indices.groups[group];
                            if (span === undefined)
                                continue;
                            pathnameMatch.push({
                                type,
                                begin: current.charOffset + span[0],
                                end: current.charOffset + span[1],
                                value: match.groups[group],
                            });
                        }
                        stack.push({
                            segmentIndex: urlSegments.length,
                            pathnameNode,
                            charOffset: current.charOffset + remaining.length,
                            pathnameMatch,
                        });
                    }
                }
            }
        }
        return results;
    }
}
function toSegments(variant) {
    let result = [];
    let key = '';
    let reSource = '';
    let type = 'static';
    for (let token of variant.tokens) {
        if (token.type === 'separator') {
            if (type === 'static') {
                result.push({ type: 'static', key });
                key = '';
                reSource = '';
                continue;
            }
            if (type === 'variable') {
                result.push({ type: 'variable', key, regexp: new RegExp(reSource, 'd') });
                key = '';
                reSource = '';
                type = 'static';
                continue;
            }
            if (type === 'wildcard') {
                key += '/';
                reSource += RE.escape('/');
                continue;
            }
            unreachable(type);
        }
        if (token.type === 'text') {
            key += token.text;
            reSource += RE.escape(token.text);
            continue;
        }
        if (token.type === ':') {
            key += '{:}';
            reSource += `(?<v${token.nameIndex}>[^/]+)`;
            if (type === 'static')
                type = 'variable';
            continue;
        }
        if (token.type === '*') {
            key += '{*}';
            reSource += `(?<w${token.nameIndex}>.*)`;
            type = 'wildcard';
            continue;
        }
        unreachable(token.type);
    }
    if (type === 'static') {
        result.push({ type: 'static', key });
    }
    if (type === 'variable' || type === 'wildcard') {
        result.push({ type, key, regexp: new RegExp(reSource, 'd') });
    }
    return result;
}
