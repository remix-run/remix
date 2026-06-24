/**
 * Service Worker for Mini WebContainers
 * Intercepts fetch requests and routes them to virtual servers
 * Version: 16
 *    - route preview iframe requests by client id so client-side navigation (clean URLs) works, not just prefix/referer matching
 *    - fix portForClient returning "" for unbound clients
 *    - only route same-origin bound-client requests; let cross-origin resources pass through to the network)
 */

const DEBUG = false;

// Communication port with main thread
let mainPort = null;

// Pending requests waiting for response
const pendingRequests = new Map();
let requestId = 0;

// Registered virtual server ports
const registeredPorts = new Set();

// Maps a browsing-context client id (the preview iframe) to the virtual server
// port it is bound to. Once a client is bound, ALL of its requests are routed
// to that virtual server regardless of URL path. This is what makes
// client-side navigation work: a SPA navigation to an absolute path like
// `/about` drops the `/__virtual__/<port>` prefix, but the request still
// originates from the bound iframe client, so we can route it correctly
// without depending on the (often-stripped) Referer header.
const clientPort = new Map();

/**
 * Remember that a client (the preview iframe) belongs to a virtual server.
 * Binds both the initiating client and, for navigations, the resulting client.
 */
function bindClient(event, port) {
  if (event.clientId) clientPort.set(event.clientId, port);
  if (event.resultingClientId) clientPort.set(event.resultingClientId, port);
}

/** Look up the virtual port a request's client is bound to, if any. */
function portForClient(event) {
  if (event.clientId && clientPort.has(event.clientId)) {
    return clientPort.get(event.clientId);
  }
  if (event.resultingClientId && clientPort.has(event.resultingClientId)) {
    return clientPort.get(event.resultingClientId);
  }
  return undefined;
}

/**
 * Decode base64 string to Uint8Array
 */
function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  DEBUG && console.log('[SW] Received message:', type, 'hasPort in event.ports:', event.ports?.length > 0);

  // When a MessagePort is transferred, it's in event.ports[0], not event.data.port
  if (type === 'init' && event.ports && event.ports[0]) {
    // Initialize communication channel
    mainPort = event.ports[0];
    mainPort.onmessage = handleMainMessage;
    DEBUG && console.log('[SW] Initialized communication channel with transferred port');
    // Re-claim clients so that pages opened after SW activation get controlled.
    // Without this, controllerchange never fires for late-arriving pages.
    self.clients.claim();
  }

  if (type === 'server-registered' && data) {
    registeredPorts.add(data.port);
    DEBUG && console.log(`[SW] Server registered on port ${data.port}`);
  }

  if (type === 'server-unregistered' && data) {
    registeredPorts.delete(data.port);
    DEBUG && console.log(`[SW] Server unregistered from port ${data.port}`);
  }
});

/**
 * Handle response messages from main thread
 */
function handleMainMessage(event) {
  const { type, id, data, error } = event.data;

  DEBUG && console.log('[SW] Received message from main:', type, 'id:', id);

  if (type === 'response') {
    const pending = pendingRequests.get(id);
    DEBUG && console.log('[SW] Looking for pending request:', id, 'found:', !!pending);

    if (pending) {
      pendingRequests.delete(id);

      if (error) {
        DEBUG && console.log('[SW] Response error:', error);
        pending.reject(new Error(error));
      } else {
        DEBUG && console.log('[SW] Response data:', {
          statusCode: data?.statusCode,
          statusMessage: data?.statusMessage,
          headers: data?.headers,
          bodyType: data?.body?.constructor?.name,
          bodyLength: data?.body?.length || data?.body?.byteLength,
        });
        pending.resolve(data);
      }
    }
  }

  // Handle streaming responses
  if (type === 'stream-start') {
    DEBUG && console.log('[SW] stream-start received, id:', id);
    const pending = pendingRequests.get(id);
    if (pending && pending.streamController) {
      // Store headers/status for the streaming response
      pending.streamData = data;
      pending.resolveHeaders(data);
      DEBUG && console.log('[SW] headers resolved for stream', id);
    } else {
      DEBUG && console.log('[SW] No pending request or controller for stream-start', id, !!pending, pending?.streamController);
    }
  }

  if (type === 'stream-chunk') {
    DEBUG && console.log('[SW] stream-chunk received, id:', id, 'size:', data?.chunkBase64?.length);
    const pending = pendingRequests.get(id);
    if (pending && pending.streamController) {
      try {
        // Decode base64 chunk and enqueue
        if (data.chunkBase64) {
          const bytes = base64ToBytes(data.chunkBase64);
          pending.streamController.enqueue(bytes);
          DEBUG && console.log('[SW] chunk enqueued, bytes:', bytes.length);
        }
      } catch (e) {
        console.error('[SW] Error enqueueing chunk:', e);
      }
    } else {
      DEBUG && console.log('[SW] No pending request or controller for stream-chunk', id);
    }
  }

  if (type === 'stream-end') {
    DEBUG && console.log('[SW] stream-end received, id:', id);
    const pending = pendingRequests.get(id);
    if (pending && pending.streamController) {
      try {
        pending.streamController.close();
        DEBUG && console.log('[SW] stream closed');
      } catch (e) {
        DEBUG && console.log('[SW] stream already closed');
      }
      pendingRequests.delete(id);
    }
  }
}

/**
 * Send request to main thread and wait for response
 */
async function sendRequest(port, method, url, headers, body) {
  DEBUG && console.log('[SW] sendRequest called, mainPort:', !!mainPort, 'url:', url);

  if (!mainPort) {
    // Ask all clients to re-send the init message
    const allClients = await self.clients.matchAll({ type: 'window' });
    for (const client of allClients) {
      client.postMessage({ type: 'sw-needs-init' });
    }
    // Wait up to 5s for a client to re-initialize the port
    // (main thread may be busy with heavy operations like CLI execution)
    await new Promise(resolve => {
      const check = setInterval(() => { if (mainPort) { clearInterval(check); resolve(); } }, 50);
      setTimeout(() => { clearInterval(check); resolve(); }, 5000);
    });
    if (!mainPort) {
      throw new Error('Service Worker not initialized - no connection to main thread');
    }
  }

  const id = ++requestId;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });

    // Set timeout for request
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 30000);

    mainPort.postMessage({
      type: 'request',
      id,
      data: { port, method, url, headers, body },
    });
  });
}

/**
 * Send streaming request to main thread
 * Returns a ReadableStream that receives chunks from main thread
 */
async function sendStreamingRequest(port, method, url, headers, body) {
  DEBUG && console.log('[SW] sendStreamingRequest called, url:', url);

  if (!mainPort) {
    // Ask all clients to re-send the init message
    const allClients = await self.clients.matchAll({ type: 'window' });
    for (const client of allClients) {
      client.postMessage({ type: 'sw-needs-init' });
    }
    await new Promise(resolve => {
      const check = setInterval(() => { if (mainPort) { clearInterval(check); resolve(); } }, 50);
      setTimeout(() => { clearInterval(check); resolve(); }, 5000);
    });
    if (!mainPort) {
      throw new Error('Service Worker not initialized');
    }
  }

  const id = ++requestId;

  let streamController;
  let resolveHeaders;
  const headersPromise = new Promise(resolve => { resolveHeaders = resolve; });

  const stream = new ReadableStream({
    start(controller) {
      streamController = controller;

      // Store in pending requests so handleMainMessage can find it
      pendingRequests.set(id, {
        resolve: () => {},
        reject: (err) => controller.error(err),
        streamController: controller,
        resolveHeaders,
      });

      // Send request to main thread with streaming flag
      mainPort.postMessage({
        type: 'request',
        id,
        data: { port, method, url, headers, body, streaming: true },
      });
    },
    cancel() {
      pendingRequests.delete(id);
    }
  });

  return { stream, headersPromise, id };
}

/**
 * Intercept fetch requests
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  DEBUG && console.log('[SW] Fetch:', url.pathname, 'mainPort:', !!mainPort);

  // Check if this is a virtual server request
  const match = url.pathname.match(/^\/__virtual__\/(\d+)(\/.*)?$/);

  if (match) {
    DEBUG && console.log('[SW] Virtual request:', url.pathname);
    const port = parseInt(match[1], 10);
    const path = match[2] || '/';
    // Bind this client so its later (clean-URL) requests route here too.
    bindClient(event, port);
    event.respondWith(handleVirtualRequest(event.request, port, path + url.search));
    return;
  }

  // Already-bound client (the preview iframe navigating with clean URLs).
  // Route SAME-ORIGIN requests to its virtual server, keeping the URL clean.
  // Cross-origin requests (fonts, esm.sh, CDNs, APIs) must pass through to the
  // network untouched.
  const boundPort = portForClient(event);
  if (boundPort != null && url.origin === self.location.origin) {
    DEBUG && console.log('[SW] Bound-client request:', url.pathname, '-> port', boundPort);
    // Re-bind in case this is a fresh navigation creating a new client.
    bindClient(event, boundPort);
    event.respondWith(
      handleVirtualRequest(event.request, boundPort, url.pathname + url.search),
    );
    return;
  }

  {
    // Not a virtual request - but check if it's from a virtual context
    // This handles plain <a href="/about"> links and asset requests (images, scripts)
    // that should stay within the virtual server
    // Cross-origin requests (fonts, esm.sh, CDNs, APIs) must pass through to
    // the network untouched, even when initiated from a virtual page.
    const referer = event.request.referrer;
    if (referer && url.origin === self.location.origin) {
      try {
        const refererUrl = new URL(referer);
        const refererMatch = refererUrl.pathname.match(/^\/__virtual__\/(\d+)/);
        if (refererMatch) {
          // Request from within a virtual server context
          const virtualPrefix = refererMatch[0];
          const virtualPort = parseInt(refererMatch[1], 10);
          const targetPath = url.pathname + url.search;

          if (event.request.mode === 'navigate') {
            // Navigation requests: redirect to include the virtual prefix
            const redirectUrl = url.origin + virtualPrefix + targetPath;
            DEBUG && console.log('[SW] Redirecting navigation from virtual context:', url.pathname, '->', redirectUrl);
            event.respondWith(Response.redirect(redirectUrl, 302));
            return;
          } else {
            // Non-navigation requests (images, scripts, etc.): forward to virtual server
            DEBUG && console.log('[SW] Forwarding resource from virtual context:', url.pathname);
            event.respondWith(handleVirtualRequest(event.request, virtualPort, targetPath));
            return;
          }
        }
      } catch (e) {
        // Invalid referer URL, ignore
      }
    }
    // Not a virtual request, let it pass through
    return;
  }
});

/**
 * Handle a request to a virtual server
 */
async function handleVirtualRequest(request, port, path) {
  try {
    // Build headers object
    const headers = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Get body if present
    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer();
    }

    // Check if this is an API route that might stream (POST to /api/*)
    const isStreamingCandidate = request.method === 'POST' && path.startsWith('/api/');

    if (isStreamingCandidate) {
      DEBUG && console.log('[SW] Using streaming mode for:', path);
      return handleStreamingRequest(port, request.method, path, headers, body);
    }
    DEBUG && console.log('[SW] Using non-streaming mode for:', request.method, path);

    // Send to main thread
    const response = await sendRequest(port, request.method, path, headers, body);

    DEBUG && console.log('[SW] Got response from main thread:', {
      statusCode: response.statusCode,
      headersKeys: response.headers ? Object.keys(response.headers) : [],
      bodyBase64Length: response.bodyBase64?.length,
    });

    // Decode base64 body and create response
    let finalResponse;
    if (response.bodyBase64 && response.bodyBase64.length > 0) {
      try {
        const bytes = base64ToBytes(response.bodyBase64);
        DEBUG && console.log('[SW] Decoded body length:', bytes.length);

        // Use Blob to ensure proper body handling
        const blob = new Blob([bytes], { type: response.headers['Content-Type'] || 'application/octet-stream' });
        DEBUG && console.log('[SW] Created blob size:', blob.size);

        // Merge response headers with CORP/COEP headers to allow iframe embedding
        // The parent page has COEP: credentialless, so we need matching headers
        const respHeaders = new Headers(response.headers);
        respHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
        respHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
        respHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
        // Remove any headers that might block iframe loading
        respHeaders.delete('X-Frame-Options');

        finalResponse = new Response(blob, {
          status: response.statusCode,
          statusText: response.statusMessage,
          headers: respHeaders,
        });
      } catch (decodeError) {
        console.error('[SW] Failed to decode base64 body:', decodeError);
        finalResponse = new Response(`Decode error: ${decodeError.message}`, {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    } else {
      finalResponse = new Response(null, {
        status: response.statusCode,
        statusText: response.statusMessage,
        headers: response.headers,
      });
    }

    DEBUG && console.log('[SW] Final Response created, status:', finalResponse.status);

    return finalResponse;
  } catch (error) {
    console.error('[SW] Error handling virtual request:', error);
    return new Response(`Service Worker Error: ${error.message}`, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Handle a streaming request
 */
async function handleStreamingRequest(port, method, path, headers, body) {
  const { stream, headersPromise, id } = await sendStreamingRequest(port, method, path, headers, body);

  // Wait for headers to arrive
  const responseData = await headersPromise;

  DEBUG && console.log('[SW] Streaming response started:', responseData?.statusCode);

  // Build response headers
  const respHeaders = new Headers(responseData?.headers || {});
  respHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
  respHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
  respHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');
  respHeaders.delete('X-Frame-Options');

  return new Response(stream, {
    status: responseData?.statusCode || 200,
    statusText: responseData?.statusMessage || 'OK',
    headers: respHeaders,
  });
}

/**
 * Activate immediately
 */
self.addEventListener('install', (event) => {
  DEBUG && console.log('[SW] Installing...');
  event.waitUntil(self.skipWaiting());
});

/**
 * Claim all clients immediately
 */
self.addEventListener('activate', (event) => {
  DEBUG && console.log('[SW] Activated');
  event.waitUntil((async () => {
    await self.clients.claim();
    // Drop client->port bindings for windows that no longer exist.
    const live = new Set(
      (await self.clients.matchAll({ type: 'window' })).map((c) => c.id),
    );
    for (const id of clientPort.keys()) {
      if (!live.has(id)) clientPort.delete(id);
    }
  })());
});
