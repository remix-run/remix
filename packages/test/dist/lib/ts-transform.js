import { transform } from 'esbuild';
/*
 * Transform a TypeScript file to JavaScript using esbuild with an inline
 * source map and no minification. Used both by the coverage ESM loader hook
 * (so V8 instruments readable JS) and by the coverage collector (so byte
 * offsets can be re-derived and mapped back to TypeScript lines).
 */
export async function transformTypeScript(source, filePath) {
    let loader = filePath.endsWith('.tsx') ? 'tsx' : 'ts';
    let result = await transform(source, {
        loader,
        sourcemap: 'inline',
        sourcesContent: true,
        sourcefile: filePath,
    });
    return { code: result.code };
}
