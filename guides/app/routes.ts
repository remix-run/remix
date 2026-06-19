import { get, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: get('/'),
  docs: route('docs', {
    index: get('/'),
    startHere: get('start-here'),
    coreAppStructure: get('core-app-structure'),
    serverRuntime: get('server-runtime'),
    renderingUi: get('rendering-ui'),
    interactivity: get('interactivity'),
    animation: get('animation'),
    dataAndValidation: get('data-and-validation'),
    formsAndMutations: get('forms-and-mutations'),
    authSessionsSecurity: get('auth-sessions-security'),
    filesAndAssets: get('files-and-assets'),
    testing: get('testing'),
    cliAndTooling: get('cli-and-tooling'),
    production: get('production'),
    advancedGuides: get('advanced-guides'),
    exampleApps: get('example-apps'),
    tutorials: get('tutorials'),
  }),
})
