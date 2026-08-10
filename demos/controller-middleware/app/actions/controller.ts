import { createController } from 'remix/router'

import { ExecutionTrace, traceController } from '../middleware/execution-trace.ts'
import { routes } from '../routes.ts'
import { traceResponse } from './trace-response.ts'

export default createController(routes, {
  middleware: [traceController('root')],
  actions: {
    home({ get }) {
      return traceResponse('home', get(ExecutionTrace))
    },
  },
})
