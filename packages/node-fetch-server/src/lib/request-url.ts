import * as http from 'node:http';
import * as net from 'node:net';
import * as tls from 'node:tls';

import { TrustProxy } from './trust-proxy.js';

/**
 * Returns the URL of an incoming request.
 */
export function getRequestUrl(req: http.IncomingMessage, trustProxy: TrustProxy): URL {
  let protocol = getProtocol(req, trustProxy);
  let hostname = getHostname(req, trustProxy);
  return new URL(`${protocol}//${hostname}${req.url}`);
}

function getProtocol(req: http.IncomingMessage, trustProxy: TrustProxy): string {
  let socket = req.socket as net.Socket | tls.TLSSocket;
  let remoteAddress = socket.remoteAddress;

  let protocol = 'encrypted' in socket && socket.encrypted ? 'https:' : 'http:';

  if (remoteAddress === undefined || !trustProxy(remoteAddress, 0)) {
    return protocol;
  }

  let header = req.headers['x-forwarded-proto'];

  if (header === undefined) {
    return protocol;
  }

  if (Array.isArray(header)) {
    header = header[0];
  }

  let index = header.indexOf(',');

  return normalizeProtocol(index === -1 ? header.trim() : header.slice(0, index).trim());
}

function normalizeProtocol(protocol: string): string {
  return (protocol.endsWith(':') ? protocol : protocol + ':').toLowerCase();
}

function getHostname(req: http.IncomingMessage, trustProxy: TrustProxy): string | undefined {
  let socket = req.socket as net.Socket | tls.TLSSocket;
  let remoteAddress = socket.remoteAddress;

  let header = req.headers['x-forwarded-host'];

  if (header === undefined || remoteAddress === undefined || !trustProxy(remoteAddress, 0)) {
    header = req.headers.host;
  } else if (Array.isArray(header)) {
    header = header[0];
  }

  if (header === undefined) return undefined;

  let index = header.indexOf(',');

  return index === -1 ? header.trim() : header.slice(0, index).trim();
}
