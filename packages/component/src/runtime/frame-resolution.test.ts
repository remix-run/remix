import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { unwrapFrameResolution } from './frame-resolution.ts'

describe('frame response CSP nonce', () => {
  it('reads a shared nonce from script and style directives without consuming the body', async () => {
    let response = new Response('<p>Frame</p>', {
      headers: {
        'Content-Security-Policy': "script-src 'nonce-AbC+/123=='; style-src 'nonce-AbC+/123=='",
      },
    })
    let resolution = await unwrapFrameResolution(response)

    expect(resolution.nonce).toBe('AbC+/123==')
    expect(resolution.content).toBe(response.body)
    expect(response.bodyUsed).toBe(false)
  })

  it('reads the nonce from default-src when element directives are absent', async () => {
    expect(await resolveNonce("default-src 'nonce-response-nonce'")).toBe('response-nonce')
  })

  it('accepts the same nonce across multiple policies', async () => {
    expect(
      await resolveNonce("script-src 'nonce-response-nonce', style-src 'nonce-response-nonce'"),
    ).toBe('response-nonce')
  })

  it('skips multiple distinct nonces within one directive', async () => {
    expect(await resolveNonce("script-src 'nonce-first' 'nonce-second'")).toBeUndefined()
  })

  it('skips different script and style nonces', async () => {
    expect(await resolveNonce("script-src 'nonce-first'; style-src 'nonce-second'")).toBeUndefined()
  })

  it('skips conflicting nonces across policies', async () => {
    expect(
      await resolveNonce("script-src 'nonce-first', script-src 'nonce-second'"),
    ).toBeUndefined()
  })

  it('uses element directives before their fallbacks', async () => {
    expect(
      await resolveNonce(
        "default-src 'nonce-unused'; script-src 'nonce-unused'; script-src-elem 'nonce-response-nonce'; style-src 'nonce-unused'; style-src-elem 'nonce-response-nonce'",
      ),
    ).toBe('response-nonce')
  })

  it('does not read nonces from fallbacks overridden by an empty directive', async () => {
    expect(
      await resolveNonce("default-src 'nonce-unused'; script-src; style-src-elem"),
    ).toBeUndefined()
  })

  it('ignores repeated directives after the first occurrence', async () => {
    expect(await resolveNonce("style-src 'nonce-response-nonce'; STYLE-SRC 'nonce-ignored'")).toBe(
      'response-nonce',
    )
    expect(await resolveNonce("style-src; style-src 'nonce-ignored'")).toBeUndefined()
  })

  it('ignores nonces in unrelated directives', async () => {
    expect(
      await resolveNonce(
        "img-src 'nonce-ignored'; script-src-attr 'nonce-ignored'; report-to 'nonce-ignored'; style-src 'nonce-response-nonce'",
      ),
    ).toBe('response-nonce')
  })

  it('accepts case-insensitive directive names and nonce prefixes without changing the value', async () => {
    expect(
      await resolveNonce("STYLE-SRC\t'NONCE-AbCd_123-=' ; style-src-elem 'nonce-AbCd_123-='"),
    ).toBe('AbCd_123-=')
  })

  it('does not treat malformed nonce sources as render nonces', async () => {
    expect(await resolveNonce('script-src nonce-unquoted')).toBeUndefined()
    expect(await resolveNonce("script-src 'nonce-'")).toBeUndefined()
    expect(await resolveNonce("script-src 'nonce-invalid!'")).toBeUndefined()
    expect(await resolveNonce("script-src 'nonce-invalid==='")).toBeUndefined()
  })

  it('does not use report-only policies to authorize nonce replacement', async () => {
    let resolution = await unwrapFrameResolution(
      new Response('', {
        headers: { 'Content-Security-Policy-Report-Only': "script-src 'nonce-report-only'" },
      }),
    )
    expect(resolution.nonce).toBeUndefined()
  })

  it('does not let a report-only nonce replace the enforcing policy nonce', async () => {
    let resolution = await unwrapFrameResolution(
      new Response('', {
        headers: {
          'Content-Security-Policy': "style-src 'nonce-enforced'",
          'Content-Security-Policy-Report-Only': "style-src 'nonce-report-only'",
        },
      }),
    )
    expect(resolution.nonce).toBe('enforced')
  })

  it('skips missing policies and policies without nonces', async () => {
    expect((await unwrapFrameResolution(new Response(''))).nonce).toBeUndefined()
    expect(await resolveNonce("script-src 'self'; style-src 'none'")).toBeUndefined()
  })
})

async function resolveNonce(policy: string): Promise<string | undefined> {
  let resolution = await unwrapFrameResolution(
    new Response('', { headers: { 'Content-Security-Policy': policy } }),
  )
  return resolution.nonce
}
