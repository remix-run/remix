import { run } from 'remix/component';
let app = run(document, {
    async loadModule(moduleUrl, name) {
        let mod = await import(moduleUrl);
        if (!mod) {
            throw new Error(`Unknown module: ${moduleUrl}`);
        }
        let Component = mod[name];
        if (!Component) {
            throw new Error(`Unknown component: ${moduleUrl}#${name}`);
        }
        return Component;
    },
});
app.ready().catch((error) => {
    console.error('Hydration failed:', error);
});
