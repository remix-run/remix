import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { getTsconfig } from 'get-tsconfig';
import { transformComponentHmr } from '@remix-run/ui-hmr/transform';
import MagicString from 'magic-string';
import { minify } from 'oxc-minify';
import { parseSync, visitorKeys } from 'oxc-parser';
import { transform as oxcTransform } from 'oxc-transform';
import { init as esModuleLexerInit, parse as esModuleLexer } from 'es-module-lexer';
import { isCommonJS, mayContainCommonJSModuleGlobals } from "./cjs-check.js";
import { createAssetServerCompilationError, isAssetServerCompilationError, } from "../compilation-error.js";
import { generateFingerprint } from "../fingerprint.js";
import { maskAuthoredInjectedPackageSpecifier, mayContainInjectedPackageSpecifier, restoreAuthoredInjectedPackageSpecifier, } from "../injected-packages.js";
import { normalizeFilePath } from "../paths.js";
import { composeSourceMaps, rewriteSourceMapSources, stringifySourceMap } from "../source-maps.js";
const scriptModuleTypes = [
    { extension: '.js', lang: 'js' },
    { extension: '.jsx', lang: 'jsx' },
    { extension: '.mjs', lang: 'js' },
    { extension: '.mts', lang: 'ts' },
    { extension: '.ts', lang: 'ts' },
    { extension: '.tsx', lang: 'tsx' },
];
const sourceLanguageByExtension = new Map(scriptModuleTypes.map(({ extension, lang }) => [extension, lang]));
const supportedTsconfigTransformCompilerOptions = {
    allowNamespaces: 'allowNamespaces',
    emitDecoratorMetadata: 'emitDecoratorMetadata',
    experimentalDecorators: 'experimentalDecorators',
    jsx: 'jsx',
    jsxFactory: 'jsxFactory',
    jsxFragmentFactory: 'jsxFragmentFactory',
    jsxImportSource: 'jsxImportSource',
    useDefineForClassFields: 'useDefineForClassFields',
};
const componentHmrRuntimeSpecifier = '@remix-run/ui-hmr/runtime';
const componentHmrRefreshSpecifiers = ['remix/ui/dev/refresh', '@remix-run/ui/dev/refresh'];
export function createTsconfigTransformOptionsResolver() {
    let fileSystemCache = new Map();
    let transformOptionsByDirectory = new Map();
    return {
        clear() {
            fileSystemCache = new Map();
            transformOptionsByDirectory.clear();
        },
        getTransformOptions(filePath, isWatchIgnored) {
            let directory = path.dirname(filePath);
            let cached = transformOptionsByDirectory.get(directory);
            if (cached)
                return cached;
            let tsconfig = getTsconfig(directory, 'tsconfig.json', fileSystemCache);
            if (!tsconfig) {
                let transformOptions = { trackedFiles: [] };
                transformOptionsByDirectory.set(directory, transformOptions);
                return transformOptions;
            }
            let tsconfigPath = findNearestTsconfigPath(directory);
            let transformOptions = {
                trackedFiles: tsconfigPath && !isWatchIgnored(tsconfigPath) ? [tsconfigPath] : [],
                tsconfigRaw: tsconfig.config,
            };
            transformOptionsByDirectory.set(directory, transformOptions);
            return transformOptions;
        },
    };
}
export async function transformModule(record, args) {
    let resolvedPath = args.resolveActualPath(record.identityPath);
    if (!resolvedPath) {
        return {
            ok: false,
            error: createAssetServerCompilationError(`File not found: ${record.identityPath}`, {
                code: 'FILE_NOT_FOUND',
            }),
            tracking: {
                trackedFiles: args.isWatchIgnored(record.identityPath) ? [] : [record.identityPath],
            },
        };
    }
    let transformOptions = args.tsconfigTransformOptionsResolver.getTransformOptions(resolvedPath, args.isWatchIgnored);
    let trackedFiles = [
        ...(args.isWatchIgnored(resolvedPath) ? [] : [resolvedPath]),
        ...transformOptions.trackedFiles,
    ];
    let sourceText;
    try {
        sourceText = await fsp.readFile(resolvedPath, 'utf-8');
    }
    catch (error) {
        if (isNoEntityError(error)) {
            return {
                ok: false,
                error: createAssetServerCompilationError(`File not found: ${resolvedPath}`, {
                    cause: error,
                    code: 'FILE_NOT_FOUND',
                }),
                tracking: {
                    trackedFiles,
                },
            };
        }
        return {
            ok: false,
            error: toTransformFailedError(error, resolvedPath),
            tracking: {
                trackedFiles,
            },
        };
    }
    try {
        let stableUrlPathname = args.routes.toUrlPathname(record.identityPath);
        if (!stableUrlPathname) {
            throw createAssetServerCompilationError(`File ${record.identityPath} is outside all configured fileMap entries.`, {
                code: 'FILE_OUTSIDE_FILE_MAP',
            });
        }
        let componentHmrRefreshSpecifier = args.componentHmr
            ? await resolveComponentHmrRefreshSpecifier(resolvedPath, {
                isAllowed: args.isAllowed,
                resolverFactory: args.resolverFactory,
            })
            : null;
        let analysis = await analyzeModuleSource(sourceText, resolvedPath, transformOptions, {
            componentHmr: componentHmrRefreshSpecifier === null
                ? undefined
                : {
                    moduleUrl: stableUrlPathname,
                    refreshSpecifier: componentHmrRefreshSpecifier,
                    runtimeSpecifier: componentHmrRuntimeSpecifier,
                },
            define: args.define ?? undefined,
            minify: args.minify,
            sourceMaps: args.sourceMaps ?? undefined,
            target: args.target ?? undefined,
        });
        analysis.unresolvedImports = analysis.unresolvedImports.filter((unresolved) => !args.externalSet.has(getDisplayImportSpecifier(unresolved.specifier)));
        if (mayContainCommonJSModuleGlobals(sourceText) && isCommonJS(analysis.rawCode)) {
            throw createAssetServerCompilationError(`CommonJS module detected: ${resolvedPath}. ` +
                `This module uses CommonJS (require/module.exports) which is not supported. ` +
                `Please use an ESM-compatible module.`, {
                code: 'COMMONJS_NOT_SUPPORTED',
            });
        }
        let sourceMap = analysis.sourceMap
            ? rewriteSourceMapSources(analysis.sourceMap, resolvedPath, stableUrlPathname, args.sourceMapSourcePaths, sourceText)
            : null;
        return {
            ok: true,
            tracking: {
                trackedFiles,
            },
            value: {
                fingerprint: args.buildId === null
                    ? null
                    : await generateFingerprint({
                        buildId: args.buildId,
                        content: sourceText,
                    }),
                hmr: getHmrAnalysis(analysis.rawCode),
                identityPath: record.identityPath,
                importerDir: path.dirname(resolvedPath),
                packageSpecifiers: analysis.unresolvedImports
                    .filter((unresolved) => isBareImportSpecifier(unresolved.specifier))
                    .map((unresolved) => unresolved.specifier),
                rawCode: analysis.rawCode,
                resolvedPath,
                sourceMap,
                stableUrlPathname,
                trackedFiles,
                unresolvedImports: analysis.unresolvedImports,
            },
        };
    }
    catch (error) {
        return {
            ok: false,
            error: toTransformFailedError(error, resolvedPath),
            tracking: {
                trackedFiles,
            },
        };
    }
}
export function getHmrAnalysis(rawCode) {
    let mayUseImportMetaHot = rawCode.includes('import.meta.hot');
    let usesImportMetaHot = false;
    let acceptedDeps = [];
    let selfAccepting = false;
    if (mayUseImportMetaHot) {
        try {
            let parseResult = parseSync('hmr-analysis.js', rawCode, {
                lang: 'js',
                sourceType: 'module',
            });
            if (parseResult.errors.length > 0) {
                throw createAssetServerCompilationError(`Failed to analyze HMR usage in transformed script. ${parseResult.errors[0]?.message ?? 'Unknown parse error'}`, {
                    code: 'TRANSFORM_FAILED',
                });
            }
            walkAst(parseResult.program, (node) => {
                if (isImportMetaHotNode(node)) {
                    usesImportMetaHot = true;
                }
                if (node.type !== 'CallExpression')
                    return;
                if (!isImportMetaHotAcceptCallee(node.callee))
                    return;
                let [firstArgument] = node.arguments;
                if (firstArgument === undefined || !isAcceptedDependencyArgument(firstArgument)) {
                    selfAccepting = true;
                    return;
                }
                acceptedDeps.push(...getAcceptedDependencies(firstArgument, rawCode));
            });
        }
        catch (error) {
            if (isAssetServerCompilationError(error))
                throw error;
            throw createAssetServerCompilationError(`Failed to analyze HMR usage in transformed script.`, {
                cause: error,
                code: 'TRANSFORM_FAILED',
            });
        }
    }
    return {
        acceptedDeps,
        selfAccepting,
        usesImportMetaHot,
    };
}
export async function resolveComponentHmrRefreshSpecifier(importerPath, options) {
    for (let refreshSpecifier of componentHmrRefreshSpecifiers) {
        let refreshResult = await options.resolverFactory.resolveFileAsync(importerPath, refreshSpecifier);
        if (!refreshResult.error &&
            refreshResult.path !== undefined &&
            path.isAbsolute(refreshResult.path) &&
            options.isAllowed(normalizeFilePath(refreshResult.path))) {
            return refreshSpecifier;
        }
    }
    return null;
}
function isImportMetaHotAcceptCallee(node) {
    let callee = unwrapChainExpression(node);
    if (callee.type !== 'MemberExpression')
        return false;
    if (callee.computed || !isIdentifierNode(callee.property, 'accept'))
        return false;
    return isImportMetaHotNode(callee.object);
}
function isImportMetaHotNode(node) {
    let hot = unwrapChainExpression(node);
    if (hot.type !== 'MemberExpression')
        return false;
    if (hot.computed || !isIdentifierNode(hot.property, 'hot'))
        return false;
    let meta = unwrapChainExpression(hot.object);
    return (meta.type === 'MetaProperty' &&
        isIdentifierNode(meta.meta, 'import') &&
        isIdentifierNode(meta.property, 'meta'));
}
function unwrapChainExpression(node) {
    return node.type === 'ChainExpression' ? node.expression : node;
}
function isIdentifierNode(node, name) {
    return node.type === 'Identifier' && node.name === name;
}
function isAcceptedDependencyArgument(node) {
    return isStringLiteralNode(node) || node.type === 'ArrayExpression';
}
function getAcceptedDependencies(node, source) {
    if (isStringLiteralNode(node)) {
        return [
            {
                end: node.end - 1,
                specifier: node.value,
                start: node.start + 1,
            },
        ];
    }
    if (node.type !== 'ArrayExpression')
        return [];
    let deps = [];
    for (let element of node.elements) {
        if (!isStringLiteralNode(element))
            continue;
        deps.push({
            end: element.end - 1,
            specifier: element.value,
            start: element.start + 1,
        });
    }
    return deps;
}
function findNearestTsconfigPath(directory) {
    let currentDirectory = directory;
    while (true) {
        let tsconfigPath = path.join(currentDirectory, 'tsconfig.json');
        if (fs.existsSync(tsconfigPath)) {
            return normalizeFilePath(tsconfigPath);
        }
        let parentDirectory = path.dirname(currentDirectory);
        if (parentDirectory === currentDirectory)
            return null;
        currentDirectory = parentDirectory;
    }
}
function isBareImportSpecifier(specifier) {
    return (!specifier.startsWith('./') &&
        !specifier.startsWith('../') &&
        !specifier.startsWith('/') &&
        !specifier.startsWith('file:') &&
        !specifier.startsWith('data:') &&
        !specifier.startsWith('http://') &&
        !specifier.startsWith('https://'));
}
async function analyzeModuleSource(sourceText, resolvedPath, transformOptions, options) {
    let maskedSourceText = maskAuthoredInjectedPackageImports(sourceText, resolvedPath);
    let transformResult;
    try {
        transformResult = await oxcTransform(resolvedPath, maskedSourceText, getTransformOptions(resolvedPath, transformOptions, options));
        assertNoCompilerErrors(transformResult.errors, resolvedPath, 'transform');
    }
    catch (error) {
        if (isAssetServerCompilationError(error))
            throw error;
        throw createAssetServerCompilationError(`Failed to transform script ${resolvedPath}. ${formatUnknownError(error)}`, {
            cause: error,
            code: 'TRANSFORM_FAILED',
        });
    }
    let rawCode = transformResult.code.trimEnd();
    let sourceMap = stringifySourceMap(transformResult.map);
    if (options.componentHmr) {
        let componentHmrResult = transformComponentHmr(rawCode, {
            moduleUrl: options.componentHmr.moduleUrl,
            refreshSpecifier: options.componentHmr.refreshSpecifier,
            runtimeSpecifier: options.componentHmr.runtimeSpecifier,
            sourceMap: options.sourceMaps != null,
        });
        if (componentHmrResult.transformed) {
            rawCode = componentHmrResult.code.trimEnd();
            sourceMap =
                componentHmrResult.map == null
                    ? sourceMap
                    : sourceMap == null
                        ? componentHmrResult.map
                        : composeSourceMaps(componentHmrResult.map, sourceMap);
        }
    }
    if (options.minify) {
        let minifyResult = await minifyModule(rawCode, resolvedPath, options.target, options.sourceMaps);
        rawCode = minifyResult.code.trimEnd();
        let minifyMap = stringifySourceMap(minifyResult.map);
        sourceMap =
            minifyMap == null
                ? sourceMap
                : sourceMap == null
                    ? minifyMap
                    : composeSourceMaps(minifyMap, sourceMap);
    }
    return {
        rawCode,
        sourceMap,
        unresolvedImports: await getUnresolvedImportsFromLexer(rawCode),
    };
}
async function minifyModule(rawCode, resolvedPath, target, sourceMaps) {
    try {
        let result = await minify(resolvedPath, rawCode, {
            compress: target ? { target } : true,
            mangle: true,
            module: true,
            sourcemap: sourceMaps != null,
        });
        assertNoCompilerErrors(result.errors, resolvedPath, 'minify');
        return result;
    }
    catch (error) {
        if (isAssetServerCompilationError(error))
            throw error;
        throw createAssetServerCompilationError(`Failed to minify script ${resolvedPath}. ${formatUnknownError(error)}`, {
            cause: error,
            code: 'TRANSFORM_FAILED',
        });
    }
}
function getTransformOptions(resolvedPath, transformOptions, options) {
    let compilerOptions = transformOptions.tsconfigRaw?.compilerOptions;
    let useDefineForClassFields = getBooleanOption(compilerOptions, supportedTsconfigTransformCompilerOptions.useDefineForClassFields);
    let jsxFactory = getStringOption(compilerOptions, supportedTsconfigTransformCompilerOptions.jsxFactory);
    let jsxFragmentFactory = getStringOption(compilerOptions, supportedTsconfigTransformCompilerOptions.jsxFragmentFactory);
    return {
        assumptions: useDefineForClassFields === false
            ? {
                setPublicClassFields: true,
            }
            : undefined,
        decorator: getDecoratorOptions(compilerOptions),
        define: options.define,
        jsx: getJsxOptions(resolvedPath, compilerOptions),
        lang: getSourceLanguageForPath(resolvedPath),
        sourceType: 'module',
        sourcemap: options.sourceMaps != null,
        target: options.target,
        typescript: {
            allowNamespaces: getBooleanOption(compilerOptions, supportedTsconfigTransformCompilerOptions.allowNamespaces),
            jsxPragma: jsxFactory,
            jsxPragmaFrag: jsxFragmentFactory,
            removeClassFieldsWithoutInitializer: useDefineForClassFields === false ? true : undefined,
        },
    };
}
function getJsxOptions(resolvedPath, compilerOptions) {
    let language = getSourceLanguageForPath(resolvedPath);
    if (language !== 'jsx' && language !== 'tsx')
        return undefined;
    let jsx = getStringOption(compilerOptions, supportedTsconfigTransformCompilerOptions.jsx);
    let importSource = getStringOption(compilerOptions, supportedTsconfigTransformCompilerOptions.jsxImportSource);
    let pragma = getStringOption(compilerOptions, supportedTsconfigTransformCompilerOptions.jsxFactory);
    let pragmaFrag = getStringOption(compilerOptions, supportedTsconfigTransformCompilerOptions.jsxFragmentFactory);
    if (jsx === 'preserve' || jsx === 'react-native') {
        throw createAssetServerCompilationError(`Unsupported tsconfig compilerOptions.jsx = "${jsx}" for ${resolvedPath}. ` +
            `Asset server must compile JSX to browser-runnable JavaScript.`, {
            code: 'TRANSFORM_FAILED',
        });
    }
    if (jsx === 'react-jsx' || jsx === 'react-jsxdev') {
        return {
            development: jsx === 'react-jsxdev',
            importSource,
            runtime: 'automatic',
        };
    }
    return {
        pragma,
        pragmaFrag,
        runtime: 'classic',
    };
}
function getDecoratorOptions(compilerOptions) {
    let legacy = getBooleanOption(compilerOptions, supportedTsconfigTransformCompilerOptions.experimentalDecorators);
    let emitDecoratorMetadata = getBooleanOption(compilerOptions, supportedTsconfigTransformCompilerOptions.emitDecoratorMetadata);
    if (legacy !== true && emitDecoratorMetadata !== true)
        return undefined;
    return {
        emitDecoratorMetadata,
        legacy,
    };
}
function getBooleanOption(compilerOptions, key) {
    let value = compilerOptions?.[key];
    return typeof value === 'boolean' ? value : undefined;
}
function getStringOption(compilerOptions, key) {
    let value = compilerOptions?.[key];
    return typeof value === 'string' ? value : undefined;
}
function assertNoCompilerErrors(errors, resolvedPath, operation) {
    if (!errors || errors.length === 0)
        return;
    throw createAssetServerCompilationError(`Failed to ${operation} script ${resolvedPath}. ${errors[0].message ?? 'Unknown error'}`, {
        code: 'TRANSFORM_FAILED',
    });
}
async function getUnresolvedImportsFromLexer(rawCode) {
    await esModuleLexerInit;
    let [imports] = esModuleLexer(rawCode);
    let unresolvedImports = [];
    for (let imported of imports) {
        let specifier = getStaticImportSpecifier(rawCode, imported);
        if (specifier == null || shouldSkipImportSpecifier(specifier))
            continue;
        unresolvedImports.push({
            specifier,
            start: imported.s,
            end: imported.e,
            quote: getImportQuote(rawCode, imported.s),
        });
    }
    return unresolvedImports;
}
function getDisplayImportSpecifier(specifier) {
    return restoreAuthoredInjectedPackageSpecifier(specifier) ?? specifier;
}
function maskAuthoredInjectedPackageImports(sourceText, resolvedPath) {
    if (!mayContainInjectedPackageSpecifier(sourceText)) {
        return sourceText;
    }
    let parseResult = parseSync(resolvedPath, sourceText, {
        lang: getSourceLanguageForPath(resolvedPath),
        sourceType: 'module',
    });
    if (parseResult.errors.length > 0) {
        return sourceText;
    }
    let replacements = [];
    walkAst(parseResult.program, (node) => {
        if (node.type !== 'ImportDeclaration' &&
            node.type !== 'ExportAllDeclaration' &&
            node.type !== 'ExportNamedDeclaration' &&
            node.type !== 'ImportExpression') {
            return;
        }
        let source = 'source' in node ? node.source : null;
        if (!isStringLiteralNode(source))
            return;
        let maskedSpecifier = maskAuthoredInjectedPackageSpecifier(source.value);
        if (maskedSpecifier == null)
            return;
        replacements.push({
            end: source.end - 1,
            specifier: maskedSpecifier,
            start: source.start + 1,
        });
    });
    if (replacements.length === 0)
        return sourceText;
    let rewrittenSource = new MagicString(sourceText);
    for (let replacement of replacements) {
        rewrittenSource.overwrite(replacement.start, replacement.end, replacement.specifier);
    }
    return rewrittenSource.toString();
}
function walkAst(node, visit) {
    visit(node);
    let keys = visitorKeys[node.type];
    if (!keys)
        return;
    let walkableNode = node;
    for (let key of keys) {
        let value = walkableNode[key];
        if (Array.isArray(value)) {
            for (let child of value) {
                if (isAstNode(child)) {
                    walkAst(child, visit);
                }
            }
            continue;
        }
        if (isAstNode(value)) {
            walkAst(value, visit);
        }
    }
}
function isAstNode(value) {
    return typeof value === 'object' && value !== null && 'type' in value;
}
function isStringLiteralNode(node) {
    return (node?.type === 'Literal' &&
        typeof node.start === 'number' &&
        typeof node.end === 'number' &&
        typeof node.value === 'string');
}
function getStaticImportSpecifier(source, imported) {
    if (imported.n != null) {
        return imported.n;
    }
    if (imported.d < 0) {
        return null;
    }
    let rawSpecifier = source.slice(imported.s, imported.e);
    if (!isStaticTemplateLiteral(rawSpecifier)) {
        return null;
    }
    return rawSpecifier.slice(1, -1);
}
function isStaticTemplateLiteral(specifier) {
    return specifier.startsWith('`') && specifier.endsWith('`') && !specifier.includes('${');
}
function shouldSkipImportSpecifier(specifier) {
    return (specifier.startsWith('data:') ||
        specifier.startsWith('http://') ||
        specifier.startsWith('https://'));
}
function getImportQuote(source, start) {
    let firstCharacter = source[start];
    if (firstCharacter === '"' || firstCharacter === "'" || firstCharacter === '`') {
        return firstCharacter;
    }
    return undefined;
}
function getSourceLanguageForPath(resolvedPath) {
    let extension = path.extname(resolvedPath).toLowerCase();
    return sourceLanguageByExtension.get(extension) ?? 'js';
}
function formatUnknownError(error) {
    return error instanceof Error ? error.message : String(error);
}
function toTransformFailedError(error, resolvedPath) {
    if (isAssetServerCompilationError(error))
        return error;
    return createAssetServerCompilationError(`Failed to transform script ${resolvedPath}. ${formatUnknownError(error)}`, {
        cause: error,
        code: 'TRANSFORM_FAILED',
    });
}
function isNoEntityError(error) {
    return (error instanceof Error && 'code' in error && error.code === 'ENOENT');
}
