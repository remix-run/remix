import { run } from 'remix/component';
let app = run(document, {
    async loadModule(moduleUrl, exportName) {
        let mod = await import(moduleUrl);
        let Component = mod[exportName];
        if (!Component) {
            throw new Error(`Unknown component: ${moduleUrl}#${exportName}`);
        }
        return Component;
    },
    async resolveFrame(src, signal) {
        let response = await fetch(src, { headers: { accept: 'text/html' }, signal });
        if (!response.ok) {
            return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`;
        }
        // let text = await response.text()
        // console.log(text)
        // return text
        if (response.body)
            return response.body;
        return response.text();
    },
});
app.ready().catch((error) => {
    console.error('Frame adoption failed:', error);
});
