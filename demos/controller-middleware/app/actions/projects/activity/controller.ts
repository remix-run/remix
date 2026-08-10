import { createController } from 'remix/router'

import { ExecutionTrace, traceController } from '../../../middleware/execution-trace.ts'
import { projectRoutes } from '../../../routes.ts'
import { traceResponse } from '../../trace-response.ts'

export default createController(projectRoutes.activity, {
  middleware: [traceController('activity')],
  actions: {
    index({ get, params }) {
      return traceResponse('projects.activity.index', get(ExecutionTrace), {
        projectId: params.projectId,
      })
    },
  },
})
