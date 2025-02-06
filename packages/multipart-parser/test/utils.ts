import SuperHeaders from '@mjackson/headers';

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
    for (let [name, part] of Object.entries(parts)) {
      pushLine(`--${boundary}`);

      if (typeof part === 'string') {
        let headers = new SuperHeaders({
          contentDisposition: {
            type: 'form-data',
            name,
          },
        });

        pushLine(`${headers}`);
        pushLine();
        pushLine(part);
      } else {
        let headers = new SuperHeaders({
          contentDisposition: {
            type: 'form-data',
            name,
            filename: part.filename,
            filenameSplat: part.filenameSplat,
          },
        });

        if (part.mediaType) {
          headers.contentType = part.mediaType;
        }

        pushLine(`${headers}`);
        pushLine();
        if (typeof part.content === 'string') {
          pushLine(part.content);
        } else {
          chunks.push(part.content);
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
