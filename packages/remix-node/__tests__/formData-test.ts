import { Blob, File } from "@web-std/file";

import { Request as NodeRequest } from "../fetch";
import { FormData as NodeFormData, parseFormData } from "../formData";
import { createMemoryUploadHandler } from "../upload/memoryUploadHandler";

describe("FormData", () => {
  it("allows for mix of set and append", () => {
    let formData = new NodeFormData();
    formData.set("single", "heyo");
    formData.append("multi", "one");
    formData.append("multi", "two");

    let results = [];
    for (let [k, v] of formData) results.push([k, v]);
    expect(results).toEqual([
      ["single", "heyo"],
      ["multi", "one"],
      ["multi", "two"]
    ]);
  });

  it("allows for mix of set and append with blobs and files", () => {
    let formData = new NodeFormData();
    formData.set("single", new Blob([]));
    formData.append("multi", new Blob([]));
    formData.append("multi", new File([], "test.txt"));

    expect(formData.getAll("single")).toHaveLength(1);
    expect(formData.getAll("multi")).toHaveLength(2);
  });

  it("plays nice with node-fetch", async () => {
    let formData = new NodeFormData();
    formData.set("a", "value");
    formData.set("blob", new Blob(["blob"]), "blob.txt");
    formData.set("file", new File(["file"], "file.txt"));

    let req = new NodeRequest("https://test.com", {
      method: "post",
      body: formData as any
    });

    let uploadHandler = createMemoryUploadHandler({});
    let parsedFormData = await parseFormData(
      req.headers.get("Content-Type"),
      req.body as any,
      undefined,
      uploadHandler
    );

    expect(parsedFormData.get("a")).toBe("value");
    let blob = parsedFormData.get("blob") as Blob;
    expect(await blob.text()).toBe("blob");
    let file = parsedFormData.get("file") as File;
    expect(file.name).toBe("file.txt");
    expect(await file.text()).toBe("file");
  });
});
