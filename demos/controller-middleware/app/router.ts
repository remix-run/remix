import { createMiddleware, createRouter, type MiddlewareContext } from 'remix/router'

import rootController from './actions/controller.ts'
import activityController from './actions/projects/activity/controller.ts'
import projectsController from './actions/projects/controller.ts'
import { initializeExecutionTrace, traceMount } from './middleware/execution-trace.ts'
import { projectRoutes, routes } from './routes.ts'

const appMiddleware = createMiddleware(initializeExecutionTrace())
type AppContext = MiddlewareContext<typeof appMiddleware>

declare module 'remix/router' {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({ middleware: appMiddleware })

router.map(routes, rootController)
router.mount('/projects', { middleware: [traceMount('projects')] }, (projects) => {
  projects.map(projectRoutes, projectsController)
  projects.map(projectRoutes.activity, activityController)
})
