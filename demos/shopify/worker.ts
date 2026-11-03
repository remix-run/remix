import { serveAgentGuide } from './app/utils/agent-response.ts'

interface Environment {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export default {
  fetch(request: Request, env: Environment): Promise<Response> {
    return serveAgentGuide(request, (assetRequest) => env.ASSETS.fetch(assetRequest))
  },
}
