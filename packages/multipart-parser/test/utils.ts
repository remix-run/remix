import SuperHeaders from '@remix-run/headers';

export type PartValue =
  | string
  | {
      filename?: string;
      filenameSplat?: string;
      mediaType?: string;
      content: string | Uint8Array;
    };

export function createMultipartMessage(
  boundary: string,
  parts?: { [name: string]: PartValue },
): Uint8Array {
  let chunks: Uint8Array[] = [];

  function pushString(string: string) {
    chunks.push(new TextEncoder().encode(string));
  }

  function pushLine(line = '') {
    pushString(line + '\r\n');
  }

  if (parts) {
    for (let [name, value] of Object.entries(parts)) {
      pushLine(`--${boundary}`);

      if (typeof value === 'string') {
        let headers = new SuperHeaders({
          contentDisposition: {
            type: 'form-data',
            name,
          },
        });

        pushLine(`${headers}`);
        pushLine();
        pushLine(value);
      } else {
        let headers = new SuperHeaders({
          contentDisposition: {
            type: 'form-data',
            name,
            filename: value.filename,
            filenameSplat: value.filenameSplat,
          },
        });

        if (value.mediaType) {
          headers.contentType = value.mediaType;
        }

        pushLine(`${headers}`);
        pushLine();
        if (typeof value.content === 'string') {
          pushLine(value.content);
        } else {
          chunks.push(value.content);
          pushLine();
        }
      }
    }
  }

  pushString(`--${boundary}--`);

  return concat(chunks);
}

export function getRandomBytes(size: number): Uint8Array {
  let chunks: Uint8Array[] = [];

  for (let i = 0; i < size; i += 65536) {
    chunks.push(crypto.getRandomValues(new Uint8Array(Math.min(size - i, 65536))));
  }

  return concat(chunks);
}

export function concat(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];

  let length = 0;
  for (let chunk of chunks) {
    length += chunk.length;
  }

  let result = new Uint8Array(length);
  let offset = 0;

  for (let chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

type InputType = 'Request' | 'Response';

export function createInput(
  type: InputType,
  url: string,
  init: RequestInit
): Request | Response {
  switch (type) {
    case 'Request':
      return new Request(url, init);
    case 'Response':
      return new Response(init.body, { headers: init.headers });
  }
}