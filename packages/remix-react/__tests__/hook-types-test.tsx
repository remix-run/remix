import type {
  DeferredResponse,
  TypedResponse,
  UseDataFunctionReturn,
} from "../components";

function isEqual<A, B>(
  arg: A extends B ? (B extends A ? true : false) : false
): void {}

describe("useLoaderData", () => {
  it("supports plain data type", () => {
    type AppData = { hello: string };
    type response = UseDataFunctionReturn<AppData>;
    isEqual<response, { hello: string }>(true);
  });

  it("supports plain Response", () => {
    type Loader = (args: any) => Response;
    type response = UseDataFunctionReturn<Loader>;
    isEqual<response, any>(true);
  });

  it("infers type regardless of redirect", () => {
    type Loader = (
      args: any
    ) => TypedResponse<{ id: string }> | TypedResponse<never>;
    type response = UseDataFunctionReturn<Loader>;
    isEqual<response, { id: string }>(true);
  });

  it("supports Response-returning loader", () => {
    type Loader = (args: any) => TypedResponse<{ hello: string }>;
    type response = UseDataFunctionReturn<Loader>;
    isEqual<response, { hello: string }>(true);
  });

  it("supports async Response-returning loader", () => {
    type Loader = (args: any) => Promise<TypedResponse<{ hello: string }>>;
    type response = UseDataFunctionReturn<Loader>;
    isEqual<response, { hello: string }>(true);
  });

  it("supports data-returning loader", () => {
    type Loader = (args: any) => { hello: string };
    type response = UseDataFunctionReturn<Loader>;
    isEqual<response, { hello: string }>(true);
  });

  it("supports async data-returning loader", () => {
    type Loader = (args: any) => Promise<{ hello: string }>;
    type response = UseDataFunctionReturn<Loader>;
    isEqual<response, { hello: string }>(true);
  });
});

describe("type serializer", () => {
  it("converts Date to string", () => {
    type AppData = { hello: Date };
    type response = UseDataFunctionReturn<AppData>;
    isEqual<response, { hello: string }>(true);
  });

  it("supports custom toJSON", () => {
    type AppData = { toJSON(): { data: string[] } };
    type response = UseDataFunctionReturn<AppData>;
    isEqual<response, { data: string[] }>(true);
  });

  it("supports recursion", () => {
    type AppData = { dob: Date; parent: AppData };
    type SerializedAppData = { dob: string; parent: SerializedAppData };
    type response = UseDataFunctionReturn<AppData>;
    isEqual<response, SerializedAppData>(true);
  });

  it("supports tuples and arrays", () => {
    type AppData = { arr: Date[]; tuple: [string, number, Date]; empty: [] };
    type response = UseDataFunctionReturn<AppData>;
    isEqual<
      response,
      { arr: string[]; tuple: [string, number, string]; empty: [] }
    >(true);
  });

  it("transforms unserializables to null in arrays", () => {
    type AppData = [Function, symbol, undefined];
    type response = UseDataFunctionReturn<AppData>;
    isEqual<response, [null, null, null]>(true);
  });

  it("transforms unserializables to never in objects", () => {
    type AppData = { arg1: Function; arg2: symbol; arg3: undefined };
    type response = UseDataFunctionReturn<AppData>;
    isEqual<response, {}>(true);
  });

  it("supports class instances", () => {
    class Test {
      arg: string;
      speak: () => string;
    }
    type Loader = (args: any) => TypedResponse<Test>;
    type response = UseDataFunctionReturn<Loader>;
    isEqual<response, { arg: string }>(true);
  });

  it("makes keys optional if the value is undefined", () => {
    type AppData = {
      arg1: string;
      arg2: number | undefined;
      arg3: undefined;
    };
    type response = UseDataFunctionReturn<AppData>;
    isEqual<response, { arg1: string; arg2?: number }>(true);
  });

  describe("deferred", () => {
    it("converts Date to string", () => {
      type AppData = DeferredResponse<{ hello: Date }>;
      type response = UseDataFunctionReturn<AppData>;
      isEqual<response, { hello: string }>(true);
    });

    it("supports custom toJSON", () => {
      type AppData = DeferredResponse<{ toJSON(): { data: string[] } }>;
      type response = UseDataFunctionReturn<AppData>;
      isEqual<response, { data: string[] }>(true);
    });

    it("supports recursion", () => {
      type T = { dob: Date; parent: T };
      type AppData = DeferredResponse<T>;
      type SerializedAppData = { dob: string; parent: SerializedAppData };
      type response = UseDataFunctionReturn<AppData>;
      isEqual<response, SerializedAppData>(true);
    });

    it("supports tuples and arrays", () => {
      type AppData = DeferredResponse<{
        arr: Date[];
        tuple: [string, number, Date];
        empty: [];
      }>;
      type response = UseDataFunctionReturn<AppData>;
      isEqual<
        response,
        { arr: string[]; tuple: [string, number, string]; empty: [] }
      >(true);
    });

    it("transforms unserializables to never in objects", () => {
      type AppData = DeferredResponse<{
        arg1: Function;
        arg2: symbol;
        arg3: undefined;
      }>;
      type response = UseDataFunctionReturn<AppData>;
      isEqual<response, {}>(true);
    });

    it("supports class instances", () => {
      class Test {
        arg: string;
        speak: () => string;
      }
      type Loader = (args: any) => DeferredResponse<Test>;
      type response = UseDataFunctionReturn<Loader>;
      isEqual<response, { arg: string }>(true);
    });

    it("makes keys optional if the value is undefined", () => {
      type AppData = {
        arg1: string;
        arg2: number | undefined;
        arg3: undefined;
      };
      type response = UseDataFunctionReturn<AppData>;
      isEqual<response, { arg1: string; arg2?: number }>(true);
    });

    it("converts Promise<Date> to Promise<string>", () => {
      type AppData = DeferredResponse<{ hello: Promise<Date> }>;
      type response = UseDataFunctionReturn<AppData>;
      isEqual<response, { hello: Promise<string> }>(true);
    });

    it("supports promise recursion", () => {
      type T = { dob: Promise<Date>; parent: T };
      type AppData = DeferredResponse<T>;
      type SerializeParentAppData = {
        dob: never;
        parent: SerializeParentAppData;
      };
      type SerializedAppData = {
        dob: Promise<string>;
        parent: SerializeParentAppData;
      };
      type response = UseDataFunctionReturn<AppData>;
      isEqual<response, SerializedAppData>(true);
    });

    it("supports promise tuples and arrays", () => {
      type AppData = DeferredResponse<{
        arr: Promise<Date[]>;
        tuple: Promise<[string, number, Date]>;
        empty: Promise<[]>;
      }>;
      type response = UseDataFunctionReturn<AppData>;
      isEqual<
        response,
        {
          arr: Promise<string[]>;
          tuple: Promise<[string, number, string]>;
          empty: Promise<[]>;
        }
      >(true);
    });

    it("transforms promise unserializables to never in objects", () => {
      type AppData = DeferredResponse<{
        arg1: Promise<Function>;
        arg2: Promise<symbol>;
        arg3: Promise<undefined>;
      }>;
      type response = UseDataFunctionReturn<AppData>;
      isEqual<
        response,
        {
          arg1: Promise<never>;
          arg2: Promise<never>;
          arg3: Promise<never>;
        }
      >(true);
    });

    it("supports promise class instances", () => {
      class Test {
        arg: string;
        speak: () => string;
      }
      type LoaderData = { test: Promise<Test> };
      type Loader = (args: any) => DeferredResponse<LoaderData>;
      type response = UseDataFunctionReturn<Loader>;
      isEqual<response, { test: Promise<{ arg: string }> }>(true);
    });

    it("makes promise keys optional if the value is undefined", () => {
      type PromiseData = {
        arg1: string;
        arg2: number | undefined;
        arg3: undefined;
      };
      type LoaderData = {
        result: Promise<PromiseData>;
      };
      type Loader = (args: any) => DeferredResponse<LoaderData>;
      type response = UseDataFunctionReturn<Loader>;
      isEqual<response, { result: Promise<{ arg1: string; arg2?: number }> }>(
        true
      );
    });
  });
});
