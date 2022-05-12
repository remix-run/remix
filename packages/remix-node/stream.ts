import type { Writable } from "stream";
import { Stream } from "stream";

const { readableHighWaterMark } = new Stream.Readable();

export async function writeReadableStreamToWritable(
  stream: ReadableStream,
  writable: Writable
) {
  let reader = stream.getReader();

  async function read() {
    let { done, value } = await reader.read();

    if (done) {
      writable.end();
      return;
    }

    writable.write(value);

    await read();
  }

  try {
    await read();
  } catch (error: any) {
    writable.destroy(error);
    throw error;
  }
}

export async function readableStreamToString(
  stream: ReadableStream<any>,
  encoding?: BufferEncoding
) {
  let reader = stream.getReader();
  let chunks: Uint8Array[] = [];

  async function read() {
    let { done, value } = await reader.read();

    if (done) {
      return;
    } else if (value) {
      chunks.push(value);
    }

    await read();
  }

  await read();

  return Buffer.concat(chunks).toString(encoding);
}

export const readableStreamFromStream = (
  source: Stream & { readableHighWaterMark?: number }
) => {
  let pump = new StreamPump(source);
  let stream = new ReadableStream(pump, pump);
  return stream;
};

class StreamPump {
  public highWaterMark: number;
  public accumalatedSize: number;
  private stream: Stream & {
    readableHighWaterMark?: number;
    readable?: boolean;
    resume?: () => void;
    pause?: () => void;
    destroy?: (error?: Error) => void;
  };
  private controller?: ReadableStreamController<Uint8Array>;

  /**
   * @param {Stream & {
   * 	readableHighWaterMark?: number
   * 	readable?:boolean,
   * 	resume?: () => void,
   * 	pause?: () => void
   * 	destroy?: (error?:Error) => void
   * }} stream
   */
  constructor(
    stream: Stream & {
      readableHighWaterMark?: number;
      readable?: boolean;
      resume?: () => void;
      pause?: () => void;
      destroy?: (error?: Error) => void;
    }
  ) {
    this.highWaterMark = stream.readableHighWaterMark || readableHighWaterMark;
    this.accumalatedSize = 0;
    this.stream = stream;
    this.enqueue = this.enqueue.bind(this);
    this.error = this.error.bind(this);
    this.close = this.close.bind(this);
  }

  /**
   * @param {Uint8Array} [chunk]
   */
  size(chunk: Uint8Array) {
    return chunk?.byteLength || 0;
  }

  /**
   * @param {ReadableStreamController<Uint8Array>} controller
   */
  start(controller: ReadableStreamController<Uint8Array>) {
    this.controller = controller;
    this.stream.on("data", this.enqueue);
    this.stream.once("error", this.error);
    this.stream.once("end", this.close);
    this.stream.once("close", this.close);
  }

  pull() {
    this.resume();
  }

  cancel(reason: Error) {
    if (this.stream.destroy) {
      this.stream.destroy(reason);
    }

    this.stream.off("data", this.enqueue);
    this.stream.off("error", this.error);
    this.stream.off("end", this.close);
    this.stream.off("close", this.close);
  }

  enqueue(chunk: Uint8Array | string) {
    if (this.controller) {
      try {
        let bytes = chunk instanceof Uint8Array ? chunk : Buffer.from(chunk);

        let available = (this.controller.desiredSize || 0) - bytes.byteLength;
        this.controller.enqueue(bytes);
        if (available <= 0) {
          this.pause();
        }
      } catch {
        this.controller.error(
          new Error(
            "Could not create Buffer, chunk must be of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object"
          )
        );
        // @ts-expect-error
        this.cancel();
      }
    }
  }

  pause() {
    if (this.stream.pause) {
      this.stream.pause();
    }
  }

  resume() {
    if (this.stream.readable && this.stream.resume) {
      this.stream.resume();
    }
  }

  close() {
    if (this.controller) {
      this.controller.close();
      delete this.controller;
    }
  }

  error(error: Error) {
    if (this.controller) {
      this.controller.error(error);
      delete this.controller;
    }
  }
}
