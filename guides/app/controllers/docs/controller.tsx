import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { docsIndexHandler } from './index-page.tsx'
import { startHereHandler } from './chapters/01-start-here.tsx'
import { coreAppStructureHandler } from './chapters/02-core-app-structure.tsx'
import { serverRuntimeHandler } from './chapters/03-server-runtime.tsx'
import { renderingUiHandler } from './chapters/04-rendering-ui.tsx'
import { interactivityHandler } from './chapters/05-interactivity.tsx'
import { animationHandler } from './chapters/06-animation.tsx'
import { dataAndValidationHandler } from './chapters/07-data-and-validation.tsx'
import { formsAndMutationsHandler } from './chapters/08-forms-and-mutations.tsx'
import { authSessionsSecurityHandler } from './chapters/09-auth-sessions-security.tsx'
import { filesAndAssetsHandler } from './chapters/10-files-and-assets.tsx'
import { testingHandler } from './chapters/11-testing.tsx'
import { cliAndToolingHandler } from './chapters/12-cli-and-tooling.tsx'
import { productionHandler } from './chapters/13-production.tsx'
import { advancedGuidesHandler } from './chapters/14-advanced-guides.tsx'
import { exampleAppsHandler } from './chapters/15-example-apps.tsx'
import { tutorialsHandler } from './chapters/16-tutorials.tsx'

export const docsController = createController(routes.docs, {
  actions: {
    index: docsIndexHandler,
    startHere: startHereHandler,
    coreAppStructure: coreAppStructureHandler,
    serverRuntime: serverRuntimeHandler,
    renderingUi: renderingUiHandler,
    interactivity: interactivityHandler,
    animation: animationHandler,
    dataAndValidation: dataAndValidationHandler,
    formsAndMutations: formsAndMutationsHandler,
    authSessionsSecurity: authSessionsSecurityHandler,
    filesAndAssets: filesAndAssetsHandler,
    testing: testingHandler,
    cliAndTooling: cliAndToolingHandler,
    production: productionHandler,
    advancedGuides: advancedGuidesHandler,
    exampleApps: exampleAppsHandler,
    tutorials: tutorialsHandler,
  },
})
