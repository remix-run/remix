import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { transformTypeScript } from "./ts-transform.js";
// Custom ESM loader hook for TypeScript files.
//
// Replaces tsx's minified transformation with an un-minified esbuild transform
// that preserves line structure. This ensures V8 coverage byte offsets map
// cleanly to TypeScript source lines via the inline source map, giving
// accurate per-line coverage rather than collapsing multiple statements onto
// a single minified line.
export async function load(url, context, nextLoad) {
    let cleanUrl = url.includes('?') ? url.slice(0, url.indexOf('?')) : url;
    if (!cleanUrl.endsWith('.ts') && !cleanUrl.endsWith('.tsx')) {
        return nextLoad(url, context);
    }
    let filePath = fileURLToPath(cleanUrl);
    let source = await readFile(filePath, 'utf-8');
    let { code } = await transformTypeScript(source, filePath);
    return { format: 'module', source: code, shortCircuit: true };
}
