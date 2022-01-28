import { Blob, File } from "@web-std/file";

import { FormData as NodeFormData, Request as NodeRequest } from "../fetch";
import { internalParseFormData } from "../parseMultipartFormData";
import { createMemoryUploadHandler } from "../upload/memoryUploadHandler";

describe("internalParseFormData", () => {
  it("plays nice with undici", async () => {
    let formData = new NodeFormData();
    formData.set("a", "value");
    formData.set("blob", new Blob(["blob"]), "blob.txt");
    formData.set("file", new File(["file"], "file.txt"));

    let req = new NodeRequest("https://test.com", {
      method: "post",
      body: formData as any
    });

    let uploadHandler = createMemoryUploadHandler({});
    let parsedFormData = await internalParseFormData(req, uploadHandler);

    expect(parsedFormData.get("a")).toBe("value");
    let blob = parsedFormData.get("blob") as Blob;
    expect(await blob.text()).toBe("blob");
    let file = parsedFormData.get("file") as File;
    expect(file.name).toBe("file.txt");
    expect(await file.text()).toBe("file");
  });
});
