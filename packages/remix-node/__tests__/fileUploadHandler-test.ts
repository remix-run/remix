import * as fs from "fs";
import * as path from "path";
import { ReadableStream } from "@remix-run/web-stream";

import { NodeOnDiskFile } from "../upload/fileUploadHandler";
import { readableStreamToString } from "../stream";

beforeAll(() => {
  global.ReadableStream = ReadableStream;
});

describe("NodeOnDiskFile", () => {
  let filepath = path.resolve(__dirname, "assets/test.txt");
  let size = fs.statSync(filepath).size;
  let contents = fs.readFileSync(filepath, "utf-8");
  let file: NodeOnDiskFile;
  beforeEach(() => {
    file = new NodeOnDiskFile(filepath, "text/plain");
  });

  it("can read file as text", async () => {
    expect(await file.text()).toBe(contents);
  });

  it("can get an arrayBuffer", async () => {
    let buffer = await file.arrayBuffer();
    expect(buffer.byteLength).toBe(size);
    expect(buffer).toEqual(Buffer.from(contents));
  });

  it("can use stream", async () => {
    expect(await readableStreamToString(file.stream() as any)).toBe(contents);
  });

  it("can slice file and change type", async () => {
    let sliced = await file.slice(1, 5, "text/rofl");
    expect(sliced.type).toBe("text/rofl");
    expect(await sliced.text()).toBe(contents.slice(1, 5));
  });

  it("can slice file and get text", async () => {
    let sliced = await file.slice(1, 5);
    expect(await sliced.text()).toBe(contents.slice(1, 5));
  });

  it("can slice file twice and get text", async () => {
    let sliced = (await file.slice(1, 5)).slice(1, 2);
    expect(await sliced.text()).toBe(contents.slice(1, 5).slice(1, 2));
  });

  it("can sice file and get an arrayBuffer", async () => {
    let sliced = await file.slice(1, 5);
    let buffer = await sliced.arrayBuffer();
    expect(buffer.byteLength).toBe(4);
    expect(buffer).toEqual(Buffer.from(contents.slice(1, 5)));
  });

  it("can slice file and use stream", async () => {
    let sliced = await file.slice(1, 5);
    expect(await readableStreamToString(sliced.stream() as any)).toBe(
      contents.slice(1, 5)
    );
  });
});
