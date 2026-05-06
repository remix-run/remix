var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { runTests } from "../../lib/executor.js";
const params = new URLSearchParams(location.search);
const testFile = params.get('file');
try {
    await import(__rewriteRelativeImportExtension(testFile));
    let results = await runTests();
    window.parent.postMessage({ type: 'test-results', results }, '*');
}
catch (error) {
    window.parent.postMessage({
        type: 'test-error',
        error: { message: error?.message ?? String(error), stack: error?.stack },
    }, '*');
}
