// Browser helpers shared by the passkey forms. The demo's passkey endpoints answer with JSON, and
// failed responses carry an `error` message written for the user.

export async function postPasskeyRequest<result>(
  url: string,
  body: FormData | object | undefined,
  signal: AbortSignal,
): Promise<result> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers:
        body == null || body instanceof FormData
          ? undefined
          : { 'Content-Type': 'application/json' },
      body: body == null || body instanceof FormData ? body : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('We could not reach the server. Check your connection and try again.')
  }

  let data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : 'Something went wrong. Please try again.',
    )
  }

  return data
}

export function getPasskeyErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'The passkey prompt was closed or timed out.'
      case 'InvalidStateError':
        return 'This device already has a passkey for your account.'
      case 'SecurityError':
        return 'Passkeys are not available at this address. Open the demo on localhost.'
      default:
        return 'Your browser could not complete the passkey request.'
    }
  }

  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}
