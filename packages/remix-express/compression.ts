import type { CompressionFilter } from "compression";

const noCompressContentTypeDefaults = [
  /text\/html/,
  /text\/remix-deferred/,
  /text\/event-stream/,
];

export interface CreateCompressionFilterOptions {
  /**
   * A list of content types that should not be compressed.
   * @default noCompressContentTypeDefaults
   */
  noCompressContentTypes?: RegExp[];
}

export function createCompressionFilter({
  noCompressContentTypes = noCompressContentTypeDefaults,
}: CreateCompressionFilterOptions = {}): CompressionFilter {
  return (req, res) => {
    let contentTypeHeader = res.getHeader("Content-Type");
    let contentType: string = "";
    if (typeof contentTypeHeader === "string") {
      contentType = contentTypeHeader;
    } else if (typeof contentTypeHeader === "number") {
      contentType = String(contentTypeHeader);
    } else if (contentTypeHeader) {
      contentType = contentTypeHeader.join("; ");
    }

    if (
      noCompressContentTypes &&
      noCompressContentTypes.some((regex) => regex.test(contentType))
    ) {
      return false;
    }

    return true;
  };
}
