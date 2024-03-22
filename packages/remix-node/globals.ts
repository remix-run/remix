import {
  ByteLengthQueuingStrategy as NodeByteLengthQueuingStrategy,
  CountQueuingStrategy as NodeCountQueuingStrategy,
  ReadableByteStreamController as NodeReadableByteStreamController,
  ReadableStream as NodeReadableStream,
  ReadableStreamBYOBReader as NodeReadableStreamBYOBReader,
  ReadableStreamBYOBRequest as NodeReadableStreamBYOBRequest,
  ReadableStreamDefaultController as NodeReadableStreamDefaultController,
  ReadableStreamDefaultReader as NodeReadableStreamDefaultReader,
  TransformStream as NodeTransformStream,
  TransformStreamDefaultController as NodeTransformStreamDefaultController,
  WritableStream as NodeWritableStream,
  WritableStreamDefaultController as NodeWritableStreamDefaultController,
  WritableStreamDefaultWriter as NodeWritableStreamDefaultWriter,
} from "node:stream/web";
import {
  File as NodeFile,
  fetch as nodeFetch,
  FormData as NodeFormData,
  Headers as NodeHeaders,
  Request as NodeRequest,
  Response as NodeResponse,
} from "undici";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production" | "test";
    }

    interface Global {
      File: typeof File;

      Headers: typeof Headers;
      Request: typeof Request;
      Response: typeof Response;
      fetch: typeof fetch;
      FormData: typeof FormData;

      ReadableStream: typeof ReadableStream;
      WritableStream: typeof WritableStream;
    }
  }

  interface RequestInit {
    duplex?: "half";
  }
}

export function installGlobals() {
  global.File = NodeFile as unknown as typeof File;

  // @ts-expect-error - overriding globals
  global.Headers = NodeHeaders;
  // @ts-expect-error - overriding globals
  global.Request = NodeRequest;
  // @ts-expect-error - overriding globals
  global.Response = NodeResponse;
  // @ts-expect-error - overriding globals
  global.fetch = nodeFetch;
  // @ts-expect-error - overriding globals
  global.FormData = NodeFormData;

  // Export everything from https://developer.mozilla.org/en-US/docs/Web/API/Streams_API
  global.ByteLengthQueuingStrategy = NodeByteLengthQueuingStrategy;
  global.CountQueuingStrategy = NodeCountQueuingStrategy;
  // @ts-expect-error - overriding globals
  global.ReadableByteStreamController = NodeReadableByteStreamController;
  // @ts-expect-error - overriding globals
  global.ReadableStream = NodeReadableStream;
  global.ReadableStreamBYOBReader = NodeReadableStreamBYOBReader;
  global.ReadableStreamBYOBRequest = NodeReadableStreamBYOBRequest;
  global.ReadableStreamDefaultController = NodeReadableStreamDefaultController;
  // @ts-expect-error - overriding globals
  global.ReadableStreamDefaultReader = NodeReadableStreamDefaultReader;
  // @ts-expect-error - overriding globals
  global.TransformStream = NodeTransformStream;
  global.TransformStreamDefaultController =
    NodeTransformStreamDefaultController;
  // @ts-expect-error - overriding globals
  global.WritableStream = NodeWritableStream;
  // @ts-expect-error - overriding globals
  global.WritableStreamDefaultController = NodeWritableStreamDefaultController;
  global.WritableStreamDefaultWriter = NodeWritableStreamDefaultWriter;
}
