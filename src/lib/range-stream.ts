/**
 * A `RangeStream` is a transform stream that filters out bytes that are outside of a specified
 * range.
 */
export class RangeStream extends TransformStream<Uint8Array, Uint8Array> {
  #bytesRead = 0;

  /**
   * @param start The start index of the range (inclusive)
   * @param end The end index of the range (exclusive)
   */
  constructor(start = 0, end = Infinity) {
    if (end < start) {
      throw new RangeError(
        "The end index must be greater than or equal to the start index"
      );
    }

    super({
      transform: (chunk, controller) => {
        let chunkLength = chunk.length;

        if (
          !(this.#bytesRead + chunkLength < start || this.#bytesRead >= end)
        ) {
          let startIndex = Math.max(start - this.#bytesRead, 0);
          let endIndex = Math.min(end - this.#bytesRead, chunkLength);
          controller.enqueue(chunk.subarray(startIndex, endIndex));
        }

        this.#bytesRead += chunkLength;
      }
    });
  }
}
