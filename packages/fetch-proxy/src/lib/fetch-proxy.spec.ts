import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FetchProxyOptions, createFetchProxy } from './fetch-proxy.js';

async function runProxy<ResponseType extends Response>(
  request: Request,
  target: string | URL,
  options?: FetchProxyOptions,
): Promise<{ request: Request; response: ResponseType }> {
  let outgoingRequest: Request;
  let proxy = createFetchProxy(target, {
    ...options,
    async fetch(input, init) {
      outgoingRequest = new Request(input, init);
      return options?.fetch?.(input, init) ?? new Response();
    },
  });

  let proxyResponse = (await proxy(request)) as ResponseType;

  assert.ok(outgoingRequest!);

  return {
    request: outgoingRequest,
    response: proxyResponse,
  };
}

describe('fetch proxy', () => {
  it('appends the request URL pathname + search to the target URL', async () => {
    let { request: request1 } = await runProxy(
      new Request('http://shopify.com'),
      'https://remix.run:3000/rsc',
    );

    assert.equal(request1.url, 'https://remix.run:3000/rsc');

    let { request: request2 } = await runProxy(
      new Request('http://shopify.com/?q=remix'),
      'https://remix.run:3000/rsc',
    );

    assert.equal(request2.url, 'https://remix.run:3000/rsc?q=remix');

    let { request: request3 } = await runProxy(
      new Request('http://shopify.com/search?q=remix'),
      'https://remix.run:3000/',
    );

    assert.equal(request3.url, 'https://remix.run:3000/search?q=remix');

    let { request: request4 } = await runProxy(
      new Request('http://shopify.com/search?q=remix'),
      'https://remix.run:3000/rsc',
    );

    assert.equal(request4.url, 'https://remix.run:3000/rsc/search?q=remix');
  });

  it('forwards request method, headers, and body', async () => {
    let { request } = await runProxy(
      new Request('http://shopify.com/search?q=remix', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'hello',
      }),
      'https://remix.run:3000/rsc',
    );

    assert.equal(request.method, 'POST');
    assert.equal(request.headers.get('Content-Type'), 'text/plain');
    assert.equal(await request.text(), 'hello');
  });

  it('does not append X-Forwarded-Proto and X-Forwarded-Host headers by default', async () => {
    let { request } = await runProxy(
      new Request('http://shopify.com:8080/search?q=remix'),
      'https://remix.run:3000/rsc',
    );

    assert.equal(request.headers.get('X-Forwarded-Proto'), null);
    assert.equal(request.headers.get('X-Forwarded-Host'), null);
  });

  it('appends X-Forwarded-Proto and X-Forwarded-Host headers when desired', async () => {
    let { request } = await runProxy(
      new Request('http://shopify.com:8080/search?q=remix'),
      'https://remix.run:3000/rsc',
      {
        xForwardedHeaders: true,
      },
    );

    assert.equal(request.headers.get('X-Forwarded-Proto'), 'http');
    assert.equal(request.headers.get('X-Forwarded-Host'), 'shopify.com:8080');
  });

  it('rewrites cookie domain and path', async () => {
    let { response } = await runProxy(
      new Request('http://shopify.com/search?q=remix'),
      'https://remix.run:3000/rsc',
      {
        async fetch() {
          return new Response(null, {
            headers: [
              ['Set-Cookie', 'name=value; Domain=remix.run:3000; Path=/rsc/search'],
              ['Set-Cookie', 'name2=value2; Domain=remix.run:3000; Path=/rsc'],
            ],
          });
        },
      },
    );

    let setCookie = response.headers.getSetCookie();
    assert.ok(setCookie);
    assert.equal(setCookie.length, 2);
    assert.equal(setCookie[0], 'name=value; Domain=shopify.com; Path=/search');
    assert.equal(setCookie[1], 'name2=value2; Domain=shopify.com; Path=/');
  });

  it('does not rewrite cookie domain and path when opting-out', async () => {
    let { response } = await runProxy(
      new Request('http://shopify.com/?q=remix'),
      'https://remix.run:3000/rsc',
      {
        rewriteCookieDomain: false,
        rewriteCookiePath: false,
        async fetch() {
          return new Response(null, {
            headers: [
              ['Set-Cookie', 'name=value; Domain=remix.run:3000; Path=/rsc/search'],
              ['Set-Cookie', 'name2=value2; Domain=remix.run:3000; Path=/rsc'],
            ],
          });
        },
      },
    );

    let setCookie = response.headers.getSetCookie();
    assert.ok(setCookie);
    assert.equal(setCookie.length, 2);
    assert.equal(setCookie[0], 'name=value; Domain=remix.run:3000; Path=/rsc/search');
    assert.equal(setCookie[1], 'name2=value2; Domain=remix.run:3000; Path=/rsc');
  });
});
