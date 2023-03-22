import { Blob as NodeBlob } from "buffer";

export const Blob = NodeBlob as unknown as typeof globalThis.Blob;

export class File extends Blob implements globalThis.File {
  private _name: string;
  private _lastModified: number;

  constructor(
    fileBits: BlobPart[],
    fileName: string = panic(
      new TypeError("File constructor requires name argument")
    ),
    options: FilePropertyBag | undefined = {}
  ) {
    super(fileBits, options);
    // Per File API spec https://w3c.github.io/FileAPI/#file-constructor
    // Every "/" character of file name must be replaced with a ":".
    /** @private */
    this._name = fileName;
    // It appears that browser do not follow the spec here.
    // String(name).replace(/\//g, ":")
    /** @private */
    this._lastModified = options.lastModified || Date.now();
  }

  /**
   * The name of the file referenced by the File object.
   * @type {string}
   */
  get name() {
    return this._name;
  }

  /**
   * The path the URL of the File is relative to.
   * @type {string}
   */
  get webkitRelativePath() {
    return "";
  }

  /**
   * Returns the last modified time of the file, in millisecond since the UNIX
   * epoch (January 1st, 1970 at Midnight).
   * @returns {number}
   */
  get lastModified() {
    return this._lastModified;
  }

  get [Symbol.toStringTag]() {
    return "File";
  }
}

const panic = (error: unknown) => {
  throw error;
};
