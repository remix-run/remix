import * as assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import * as http from 'node:http';
import * as stream from 'node:stream';

import { type FetchHandler } from './fetch-handler.ts';
import { createRequestListener } from './request-listener.ts';

describe('createRequestListener', () => {
  it('returns a request listener', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () => {
        return new Response('Hello, world!');
      };

      let listener = createRequestListener(handler);
      assert.ok(listener);

      let req = createMockRequest();
      let res = createMockResponse({ req });

      let chunks: Uint8Array[] = [];
      mock.method(res, 'write', (chunk: Uint8Array) => {
        chunks.push(chunk);
      });

      mock.method(res, 'end', () => {
        let body = Buffer.concat(chunks).toString();
        assert.equal(body, 'Hello, world!');
        resolve();
      });

      listener(req, res);
    });
  });

  it('calls onError when an error is thrown in the request handler', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () => {
        throw new Error('boom!');
      };
      let errorHandler = mock.fn();

      let listener = createRequestListener(handler, { onError: errorHandler });
      assert.ok(listener);

      let req = createMockRequest();
      let res = createMockResponse({ req });

      mock.method(res, 'end', () => {
        assert.equal(errorHandler.mock.calls.length, 1);
        resolve();
      });

      listener(req, res);
    });
  });

  it('returns a 500 "Internal Server Error" response when an error is thrown in the request handler', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () => {
        throw new Error('boom!');
      };
      let errorHandler = async () => {
        // ignore
      };

      let listener = createRequestListener(handler, { onError: errorHandler });
      assert.ok(listener);

      let req = createMockRequest();
      let res = createMockResponse({ req });

      let status: number | undefined;
      mock.method(res, 'writeHead', (statusCode: number) => {
        status = statusCode;
      });

      let chunks: Uint8Array[] = [];
      mock.method(res, 'write', (chunk: Uint8Array) => {
        chunks.push(chunk);
      });

      mock.method(res, 'end', () => {
        assert.equal(status, 500);
        let body = Buffer.concat(chunks).toString();
        assert.equal(body, 'Internal Server Error');
        resolve();
      });

      listener(req, res);
    });
  });

  it('uses the `Host` header to construct the URL by default', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async (request) => {
        assert.equal(request.url, 'http://example.com/');
        return new Response('Hello, world!');
      };

      let listener = createRequestListener(handler);
      assert.ok(listener);

      let req = createMockRequest({ headers: { host: 'example.com' } });
      let res = createMockResponse({ req });

      listener(req, res);
      resolve();
    });
  });

  it('uses the `host` option to override the `Host` header', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async (request) => {
        assert.equal(request.url, 'http://remix.run/');
        return new Response('Hello, world!');
      };

      let listener = createRequestListener(handler, { host: 'remix.run' });
      assert.ok(listener);

      let req = createMockRequest({ headers: { host: 'example.com' } });
      let res = createMockResponse({ req });

      listener(req, res);
      resolve();
    });
  });

  it('uses the `protocol` option to construct the URL', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async (request) => {
        assert.equal(request.url, 'https://example.com/');
        return new Response('Hello, world!');
      };

      let listener = createRequestListener(handler, { protocol: 'https:' });
      assert.ok(listener);

      let req = createMockRequest({ headers: { host: 'example.com' } });
      let res = createMockResponse({ req });

      listener(req, res);
      resolve();
    });
  });

  it('sets multiple Set-Cookie headers', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () => {
        let headers = new Headers();
        headers.set('Content-Type', 'text/plain');
        headers.append('Set-Cookie', 'a=1');
        headers.append('Set-Cookie', 'b=2');
        return new Response('Hello, world!', { headers });
      };

      let listener = createRequestListener(handler);
      assert.ok(listener);

      let req = createMockRequest();
      let res = createMockResponse({ req });

      let headers: string[];
      mock.method(res, 'writeHead', (_status: number, headersArray: string[]) => {
        headers = headersArray;
      });

      mock.method(res, 'end', () => {
        assert.deepEqual(headers, {
          'content-type': 'text/plain',
          'set-cookie': ['a=1', 'b=2'],
        });
        resolve();
      });

      listener(req, res);
    });
  });

  it('truncates the response body when the request method is HEAD', async () => {
    await new Promise<void>((resolve) => {
      let handler: FetchHandler = async () => {
        return new Response('Hello, world!');
      };

      let listener = createRequestListener(handler);
      assert.ok(listener);

      let req = createMockRequest({ method: 'HEAD' });
      let res = createMockResponse({ req });

      let chunks: Uint8Array[] = [];
      mock.method(res, 'write', (chunk: Uint8Array) => {
        chunks.push(chunk);
      });

      mock.method(res, 'end', () => {
        assert.equal(chunks.length, 0);
        resolve();
      });

      listener(req, res);
    });
  });
});

function createMockRequest({
  url = '/',
  method = 'GET',
  headers = {},
  socket = {},
  body,
}: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  socket?: {
    encrypted?: boolean;
    remoteAddress?: string;
  };
  body?: string | Buffer;
} = {}): http.IncomingMessage {
  let rawHeaders = Object.entries(headers).flatMap(([key, value]) => [key, value]);

  return Object.assign(
    new stream.Readable({
      read() {
        if (body != null) this.push(Buffer.from(body));
        this.push(null);
      },
    }),
    {
      url,
      method,
      rawHeaders,
      socket,
    },
  ) as http.IncomingMessage;
}

function createMockResponse({
  req = createMockRequest(),
}: {
  req: http.IncomingMessage;
}): http.ServerResponse {
  return Object.assign(new stream.Writable(), {
    req,
    writeHead() {},
    write() {},
    end() {},
  }) as unknown as http.ServerResponse;
}
