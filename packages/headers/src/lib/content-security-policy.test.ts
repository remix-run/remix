import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import type { ContentSecurityPolicyInit } from './content-security-policy.ts'
import { ContentSecurityPolicy } from './content-security-policy.ts'

describe('ContentSecurityPolicy', () => {
  it('serializes source lists and valueless directives', () => {
    let policy = new ContentSecurityPolicy({
      defaultSrc: ["'self'"],
      scriptSrc: ["'nonce-abc'", "'strict-dynamic'"],
      styleSrc: ["'nonce-abc'"],
      sandbox: [],
      upgradeInsecureRequests: true,
    })
    assert.equal(
      policy.toString(),
      "default-src 'self'; script-src 'nonce-abc' 'strict-dynamic'; style-src 'nonce-abc'; sandbox; upgrade-insecure-requests",
    )
  })

  it('parses ASCII whitespace and keeps the first duplicate directive', () => {
    let policy = ContentSecurityPolicy.from(
      " ; SCRIPT-SRC\t'self'\nhttps://cdn.example; script-src *; sandbox; sandbox allow-scripts; ",
    )
    assert.deepEqual(policy.get('Script-Src'), ["'self'", 'https://cdn.example'])
    assert.deepEqual(policy.get('sandbox'), [])
    assert.equal(policy.toString(), "script-src 'self' https://cdn.example; sandbox")
  })

  it('preserves extension directives and supports editing by name', () => {
    let policy = ContentSecurityPolicy.from('future-directive foo; img-src https:')
    assert.equal(policy.toString(), 'future-directive foo; img-src https:')
    policy.set('IMG-SRC', ["'self'"])
    policy.delete('FUTURE-DIRECTIVE')
    assert.equal(policy.toString(), "img-src 'self'")
    assert.equal(policy.get('future-directive'), undefined)
  })

  it('copies inputs and returned lists', () => {
    let sources = ["'self'"]
    let policy = new ContentSecurityPolicy({ defaultSrc: sources })
    sources.push('*')
    policy.get('default-src')?.push('*')
    let copy = ContentSecurityPolicy.from(policy)
    copy.set('default-src', ['*'])
    assert.equal(policy.toString(), "default-src 'self'")
  })

  it('rejects policy lists instead of merging independently enforced policies', () => {
    assert.throws(
      () => ContentSecurityPolicy.from("script-src 'self', script-src https:"),
      /single Content Security Policy/,
    )
  })

  it('rejects directive and token delimiters in structured input', () => {
    let policy = new ContentSecurityPolicy()
    assert.throws(() => policy.set('script-src; img-src', ['*']), /Invalid CSP directive/)
    assert.throws(
      () => policy.set('script-src', ["'self'; img-src *"]),
      /Invalid CSP directive token/,
    )
    assert.throws(() => policy.set('script-src', ["'self',"]), /Invalid CSP directive token/)
    assert.throws(() => policy.set('script-src', ['https:\n*']), /Invalid CSP directive token/)
  })

  it('serializes a report-to endpoint string and reads it as tokens', () => {
    let policy = new ContentSecurityPolicy({ reportTo: 'csp' })
    assert.equal(policy.toString(), 'report-to csp')
    assert.deepEqual(policy.get('report-to'), ['csp'])
    assert.equal(ContentSecurityPolicy.from(policy).toString(), 'report-to csp')
    assert.deepEqual(ContentSecurityPolicy.from('REPORT-TO csp').get('report-to'), ['csp'])
  })

  it('rejects empty and multiple report-to endpoints', () => {
    let policy = new ContentSecurityPolicy()
    assert.throws(() => policy.set('report-to', []), /exactly one endpoint/)
    assert.throws(() => policy.set('REPORT-TO', ['one', 'two']), /exactly one endpoint/)
    assert.throws(() => ContentSecurityPolicy.from('report-to'), /exactly one endpoint/)
    assert.throws(() => ContentSecurityPolicy.from('report-to one two'), /exactly one endpoint/)
  })

  it('rejects empty and multiple endpoint names in reportTo strings', () => {
    assert.throws(
      () => new ContentSecurityPolicy({ reportTo: '' }),
      /Invalid CSP report-to endpoint/,
    )
    assert.throws(
      () => new ContentSecurityPolicy({ reportTo: 'one two' }),
      /Invalid CSP report-to endpoint/,
    )
  })

  it('rejects report-to endpoints that are not HTTP tokens', () => {
    let policy = new ContentSecurityPolicy()
    assert.throws(() => policy.set('report-to', ['/reports']), /Invalid CSP report-to endpoint/)
    assert.throws(
      () => ContentSecurityPolicy.from('report-to https://example.com'),
      /Invalid CSP report-to endpoint/,
    )
  })

  it('omits disabled directives and preserves an explicit empty source list', () => {
    let policy = new ContentSecurityPolicy({
      scriptSrc: [],
      styleSrc: undefined,
      upgradeInsecureRequests: false,
    })
    assert.equal(policy.toString(), 'script-src')
    assert.equal(ContentSecurityPolicy.from(null).toString(), '')
  })

  it('serializes every initializer directive with its hyphenated name', () => {
    let policy = new ContentSecurityPolicy({
      defaultSrc: ['a'],
      scriptSrc: ['a'],
      scriptSrcElem: ['a'],
      scriptSrcAttr: ['a'],
      styleSrc: ['a'],
      styleSrcElem: ['a'],
      styleSrcAttr: ['a'],
      imgSrc: ['a'],
      fontSrc: ['a'],
      connectSrc: ['a'],
      mediaSrc: ['a'],
      objectSrc: ['a'],
      frameSrc: ['a'],
      childSrc: ['a'],
      workerSrc: ['a'],
      manifestSrc: ['a'],
      baseUri: ['a'],
      formAction: ['a'],
      frameAncestors: ['a'],
      sandbox: ['a'],
      upgradeInsecureRequests: true,
      reportTo: 'a',
      reportUri: ['a'],
      trustedTypes: ['a'],
      requireTrustedTypesFor: ['a'],
    })
    assert.equal(
      policy.toString(),
      'default-src a; script-src a; script-src-elem a; script-src-attr a; style-src a; style-src-elem a; style-src-attr a; img-src a; font-src a; connect-src a; media-src a; object-src a; frame-src a; child-src a; worker-src a; manifest-src a; base-uri a; form-action a; frame-ancestors a; sandbox a; upgrade-insecure-requests; report-to a; report-uri a; trusted-types a; require-trusted-types-for a',
    )
  })

  it('hyphenates untyped initializer keys outside the known directives', () => {
    let init = { fencedFrameSrc: ["'none'"], toString: ["'self'"] }
    let policy = new ContentSecurityPolicy(init as ContentSecurityPolicyInit)
    assert.equal(policy.toString(), "fenced-frame-src 'none'; to-string 'self'")
  })
})
