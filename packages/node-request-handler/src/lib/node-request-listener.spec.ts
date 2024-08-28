import * as assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import * as http from 'node:http';
import * as stream from 'node:stream';

import { RequestHandler } from './request-handler.js';
import { createRequestListener } from './node-request-listener.js';

describe('createRequestListener', () => {
  it('returns a request listener', async () => {
    await new Promise<void>((resolve) => {
      let handler: RequestHandler = async () => {
        return new Response('Hello, world!');
      };

      let listener = createRequestListener(handler);
      assert.ok(listener);

      let req = createIncomingMessage();
      let res = createServerResponse();

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
      let handler: RequestHandler = async () => {
        throw new Error('boom!');
      };
      let errorHandler = mock.fn();

      let listener = createRequestListener(handler, { onError: errorHandler });
      assert.ok(listener);

      let req = createIncomingMessage();
      let res = createServerResponse();

      mock.method(res, 'end', () => {
        assert.equal(errorHandler.mock.calls.length, 1);
        resolve();
      });

      listener(req, res);
    });
  });
});

function createIncomingMessage({
  url = '/',
  method = 'GET',
  headers = {},
  socket = {},
  body,
}: {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[]>;
  socket?: {
    encrypted?: boolean;
    remoteAddress?: string;
  };
  body?: string | Buffer;
} = {}): http.IncomingMessage {
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
      headers,
      socket,
    },
  ) as unknown as http.IncomingMessage;
}

function createServerResponse(): http.ServerResponse {
  return Object.assign(new stream.Writable(), {
    statusCode: 200,
    statusMessage: 'OK',
    setHeader() {},
    write() {},
    end() {},
  }) as unknown as http.ServerResponse;
}
