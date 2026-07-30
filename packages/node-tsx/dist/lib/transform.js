import { transformSync } from 'oxc-transform';
import { getTsconfig } from 'get-tsconfig';
import * as path from 'node:path';
import { getModuleFormat } from "./package-type.js";
const tsconfigCache = new Map();
const tsconfigTransformCompilerOptionKeys = [
    'jsx',
    'jsxFactory',
    'jsxFragmentFactory',
    'jsxImportSource',
];
export function transformModule(filePath, source) {
    let compilerOptions = getTsconfigCompilerOptions(filePath);
    let result = transformSync(filePath, source, {
        lang: getLanguage(filePath),
        sourceType: getSourceType(filePath, source),
        sourcemap: true,
        ...getJsxTransformOptions(filePath, compilerOptions),
    });
    if (result.errors.length > 0) {
        throw createTransformError(result.errors);
    }
    if (result.map == null) {
        return result.code;
    }
    return `${result.code}\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(result.map)).toString('base64')}`;
}
function createTransformError(errors) {
    let message = errors.map((error) => error.message).join('\n');
    let error = new SyntaxError(message);
    error.stack = errors.map(formatTransformError).join('\n\n');
    return error;
}
function formatTransformError(error) {
    let sections = [error.codeframe?.trimEnd() ?? error.message, `SyntaxError: ${error.message}`];
    if (error.helpMessage != null) {
        sections.push(error.helpMessage);
    }
    return sections.join('\n\n');
}
function getSourceType(filePath, source) {
    return getModuleFormat(filePath, source) === 'module' ? 'module' : 'commonjs';
}
function getLanguage(filePath) {
    if (filePath.endsWith('.tsx'))
        return 'tsx';
    if (filePath.endsWith('.jsx'))
        return 'jsx';
    return 'ts';
}
function getTsconfigCompilerOptions(filePath) {
    let parsed = getTsconfig(path.dirname(filePath), 'tsconfig.json', tsconfigCache);
    if (parsed == null) {
        return undefined;
    }
    let compilerOptions = parsed.config.compilerOptions;
    if (typeof compilerOptions !== 'object' || compilerOptions === null) {
        return undefined;
    }
    return parseTsconfigTransformCompilerOptions(filePath, compilerOptions);
}
function parseTsconfigTransformCompilerOptions(filePath, compilerOptions) {
    let options = {};
    let issues = [];
    for (let key of tsconfigTransformCompilerOptionKeys) {
        let value = compilerOptions[key];
        if (value === undefined) {
            continue;
        }
        if (typeof value !== 'string') {
            issues.push({ key, value });
            continue;
        }
        options[key] = value;
    }
    if (issues.length > 0) {
        throw createTsconfigCompilerOptionsError(filePath, issues);
    }
    return options;
}
function createTsconfigCompilerOptionsError(filePath, issues) {
    let details = issues.map(formatTsconfigCompilerOptionsIssue).join('\n');
    return new Error(`Invalid tsconfig compilerOptions for ${filePath}.\n` +
        `remix/node-tsx only supports string values for JSX transform options.\n${details}`);
}
function formatTsconfigCompilerOptionsIssue(issue) {
    return `- compilerOptions.${issue.key}: Expected string, received ${getValueType(issue.value)}`;
}
function getValueType(value) {
    if (Array.isArray(value)) {
        return 'array';
    }
    if (value === null) {
        return 'null';
    }
    return typeof value;
}
function getJsxTransformOptions(filePath, compilerOptions) {
    let jsx = compilerOptions?.jsx;
    let importSource = compilerOptions?.jsxImportSource;
    let factory = compilerOptions?.jsxFactory;
    let fragment = compilerOptions?.jsxFragmentFactory;
    if (jsx === 'preserve' || jsx === 'react-native') {
        throw new Error(`Unsupported tsconfig compilerOptions.jsx = "${jsx}" for ${filePath}. ` +
            'remix/node-tsx must compile JSX to runnable JavaScript.');
    }
    if (jsx == null || jsx === 'react-jsx' || jsx === 'react-jsxdev') {
        return {
            jsx: {
                development: jsx === 'react-jsxdev',
                importSource,
                runtime: 'automatic',
            },
        };
    }
    return {
        jsx: {
            pragma: factory,
            pragmaFrag: fragment,
            runtime: 'classic',
        },
    };
}
