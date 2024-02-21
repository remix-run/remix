import { getServerBuild } from "../build";

it("getServerBuild throws when path is relative", async () => {
  await expect(() => getServerBuild("./build/server/index.js")).rejects.toThrow(
    "Server build path must be absolute, but received relative path: ./build/server/index.js"
  );
});

it("getServerBuild throws when build does not exist", async () => {
  await expect(() =>
    getServerBuild("/this/path/doesnt/exist.js")
  ).rejects.toThrow(
    "Could not import server build from '/this/path/doesnt/exist.js'. Did you forget to run 'remix vite:build' first?"
  );
});
