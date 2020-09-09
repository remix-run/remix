import { readVendorFile } from "./utils";

const reactRefreshRuntimeCode = readVendorFile(
  "react-refresh/cjs/react-refresh-runtime.development.js"
).replace("process.env.NODE_ENV", JSON.stringify("development"));

// Copied from https://github.com/pikapkg/create-snowpack-app/blob/master/packages/plugin-react-refresh/plugin.js
const reactRefreshRuntime = `
<script>
function debounce(e,t){let u;return()=>{clearTimeout(u),u=setTimeout(e,t)}}
var exports = {};
${reactRefreshRuntimeCode}
exports.performReactRefresh = debounce(exports.performReactRefresh, 30);
window.$RefreshRuntime$ = exports;
window.$RefreshRuntime$.injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
</script>
`;

export { reactRefreshRuntime as runtime };
