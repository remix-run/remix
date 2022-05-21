import type { TypedResponse, UseLoaderData } from "../components";

function isEqual<A, B>(
  arg: A extends B ? (B extends A ? true : false) : false
): void {}

describe("useLoaderData", () => {
  it("supports plain data type", () => {
    type AppData = { hello: string };
    type response = UseLoaderData<AppData>;
    isEqual<response, { hello: string }>(true);
  });

  it("supports Response-returning loader", () => {
    type Loader = (args: any) => TypedResponse<{ hello: string }>;
    type response = UseLoaderData<Loader>;
    isEqual<response, { hello: string }>(true);
  });

  it("supports async Response-returning loader", () => {
    type Loader = (args: any) => Promise<TypedResponse<{ hello: string }>>;
    type response = UseLoaderData<Loader>;
    isEqual<response, { hello: string }>(true);
  });

  it("supports data-returning loader", () => {
    type Loader = (args: any) => { hello: string };
    type response = UseLoaderData<Loader>;
    isEqual<response, { hello: string }>(true);
  });

  it("supports async data-returning loader", () => {
    type Loader = (args: any) => Promise<{ hello: string }>;
    type response = UseLoaderData<Loader>;
    isEqual<response, { hello: string }>(true);
  });
});
