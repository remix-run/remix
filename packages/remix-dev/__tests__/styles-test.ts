import {isCssUrlWithoutInjection} from "../vite/styles";

describe("css urls with and without injection", () => {
  const urlsWithInjection = [
    "my/file.css",
    "my/file.css?foo",
    "my/file.css?foo&bar",
    "my/file.css?inlinex",
    "my/file.css?rawx",
    "my/file.css?urlx",
  ];
  const urlsWithoutInjection = [
    "my/file.css?inline",
    "my/file.css?inline-css",
    "my/file.css?inline&raw",
    "my/file.css?raw",
    "my/file.css?raw&url",
    "my/file.css?url",
    "my/file.css?url&raw",
  ];

  it("are matched properly", () => {
    for (const url of urlsWithoutInjection) {
      expect(isCssUrlWithoutInjection(url)).toBe(true);
    }
    for (const url of urlsWithInjection) {
      expect(isCssUrlWithoutInjection(url)).toBe(false);
    }
  });
})
