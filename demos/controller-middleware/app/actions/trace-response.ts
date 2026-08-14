export function traceResponse(
  routeName: string,
  trace: string[] | undefined,
  params: Record<string, string> = {},
): Response {
  if (!trace) throw new Error('Execution trace middleware did not run')

  trace.push(`${routeName} action`)

  return Response.json({
    route: routeName,
    params,
    trace,
  })
}
