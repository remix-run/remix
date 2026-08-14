import { createController } from 'remix/router'

import { ExecutionTrace, traceController } from '../../middleware/execution-trace.ts'
import { projectRoutes } from '../../routes.ts'
import { traceResponse } from '../trace-response.ts'

export default createController(projectRoutes, {
  middleware: [traceController('projects')],
  actions: {
    index({ get }) {
      return traceResponse('projects.index', get(ExecutionTrace))
    },
  },
})
